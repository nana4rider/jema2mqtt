import requestJemaAccess from "./jema";
import mqtt from "mqtt";
import env from "env-var";
import fs from "fs/promises";

const MESSAGE_ACTIVE = "ACTIVE";
const MESSAGE_INACTIVE = "INACTIVE";

type Config = {
  deviceId: string;
  entities: Entity[];
};

type Entity = {
  uniqueId: string;
  name: string;
  component: EntityComponent;
  controlGpio: number;
  monitorGpio: number;
};

type EntityComponent = "lock" | "switch";

enum TopicType {
  COMMAND = "set",
  STATE = "state",
  AVAILABILITY = "availability",
}

function getTopic(device: Entity, type: TopicType): string {
  return `jema-mqtt/${device.uniqueId}/${type}`;
}

async function main() {
  console.log("jema-mqtt: start");

  const haDiscoveryPrefix = env
    .get("HA_DISCOVERY_PREFIX")
    .default("homeassistant")
    .asString();

  const { deviceId, entities }: Config = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  );

  const getDiscoveryMessage = (entity: Entity): string => {
    const deviceInfo = {
      identifiers: [deviceId],
      name: `jema-mqtt.${deviceId}`,
      model: "jema-mqtt",
      manufacturer: "nana4rider",
    };

    if (entity.component === "lock" || entity.component === "switch") {
      return JSON.stringify({
        unique_id: entity.uniqueId,
        name: entity.name,
        command_topic: getTopic(entity, TopicType.COMMAND),
        state_topic: getTopic(entity, TopicType.STATE),
        availability_topic: getTopic(entity, TopicType.AVAILABILITY),
        payload_lock: MESSAGE_ACTIVE,
        payload_unlock: MESSAGE_INACTIVE,
        state_locked: MESSAGE_ACTIVE,
        state_unlocked: MESSAGE_INACTIVE,
        optimistic: false,
        retain: true,
        device: deviceInfo,
      });
    }

    throw new Error(`unknown type: ${entity.component}`);
  };

  const jemas = await Promise.all(
    entities.map((entity) =>
      requestJemaAccess(entity.controlGpio, entity.monitorGpio),
    ),
  );

  const client = mqtt.connect(env.get("MQTT_BROKER").required().asString(), {
    username: env.get("MQTT_USERNAME").asString(),
    password: env.get("MQTT_PASSWORD").asString(),
  });

  await new Promise<void>((resolve, reject) => {
    client.on("connect", () => {
      console.log("mqtt: connected");
      entities.forEach((entity) => {
        client.subscribe(getTopic(entity, TopicType.COMMAND), (err) => {
          if (err) {
            reject(err);
            return;
          }
        });
      });
      resolve();
    });
    client.on("error", reject);
  });

  // 受信して状態を変更
  client.on("message", async (topic, payload) => {
    const entityIndex = entities.findIndex(
      (entity) => getTopic(entity, TopicType.COMMAND) === topic,
    );
    if (entityIndex === -1) return;

    const message = payload.toString();
    const monitor = await jemas[entityIndex].getMonitor();
    if (
      (message === MESSAGE_ACTIVE && !monitor) ||
      (message === MESSAGE_INACTIVE && monitor)
    ) {
      await jemas[entityIndex].sendControl();
    }
  });

  entities.map(async (entity, index) => {
    const publishState = async (value: boolean) => {
      await client.publishAsync(
        getTopic(entity, TopicType.STATE),
        value ? MESSAGE_ACTIVE : MESSAGE_INACTIVE,
        { retain: true },
      );
    };
    const jema = jemas[index];
    // 状態の変更を検知して送信
    jema.setMonitorListener(publishState);
    // 起動時に送信
    await publishState(await jema.getMonitor());
    // Home Assistantでデバイスを検出
    await client.publishAsync(
      `${haDiscoveryPrefix}/${entity.component}/${deviceId}/${entity.uniqueId}/config`,
      getDiscoveryMessage(entity),
    );
  });

  const publishAvailability = async (value: string) => {
    await Promise.all(
      entities.map((entity) =>
        client.publishAsync(getTopic(entity, TopicType.AVAILABILITY), value),
      ),
    );
  };

  // オンライン状態を定期的に送信
  const timerId = setInterval(() => {
    publishAvailability("online");
  }, env.get("AVAILABILITY_INTERVAL").default(10000).asIntPositive());

  const shutdownHandler = async () => {
    console.log("jema-mqtt: shutdown");
    clearInterval(timerId);
    await publishAvailability("offline");
    process.exit(0);
  };

  process.on("SIGINT", shutdownHandler); // Ctrl+C
  process.on("SIGTERM", shutdownHandler); // kill コマンドやシステム停止

  await publishAvailability("online");

  console.log("jema-mqtt: ready");
}

main();
