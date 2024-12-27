import requestJemaAccess from "./jema";
import mqtt from "mqtt";
import env from "env-var";
import fs from "fs/promises";

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

const TopicType = {
  COMMAND: "set",
  STATE: "state",
  AVAILABILITY: "availability",
} as const;
type TopicType = (typeof TopicType)[keyof typeof TopicType];

const StatusMessage = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
type StatusMessage = (typeof StatusMessage)[keyof typeof StatusMessage];

function getTopic(device: Entity, type: TopicType): string {
  return `jema2mqtt/${device.uniqueId}/${type}`;
}

async function main() {
  console.log("jema2mqtt: start");

  const haDiscoveryPrefix = env
    .get("HA_DISCOVERY_PREFIX")
    .default("homeassistant")
    .asString();

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as Config;

  const getDiscoveryMessage = (entity: Entity): string => {
    const createMessage = (obj: Record<string, string>) =>
      JSON.stringify({
        unique_id: entity.uniqueId,
        name: entity.name,
        optimistic: false,
        device: {
          identifiers: [deviceId],
          name: `jema2mqtt.${deviceId}`,
          model: "jema2mqtt",
          manufacturer: "nana4rider",
        },
        ...obj,
      });
    const { component } = entity;

    if (component === "lock" || component === "switch") {
      return createMessage({
        command_topic: getTopic(entity, TopicType.COMMAND),
        state_topic: getTopic(entity, TopicType.STATE),
        availability_topic: getTopic(entity, TopicType.AVAILABILITY),
        payload_lock: StatusMessage.ACTIVE,
        payload_unlock: StatusMessage.INACTIVE,
        state_locked: StatusMessage.ACTIVE,
        state_unlocked: StatusMessage.INACTIVE,
      });
    }

    throw new Error(`unknown component: ${entity.component}`);
  };

  const jemas = new Map(
    await Promise.all(
      entities.map(async ({ uniqueId, controlGpio, monitorGpio }) => {
        const jema = await requestJemaAccess(controlGpio, monitorGpio);
        return [uniqueId, jema] as const;
      }),
    ),
  );

  const client = await mqtt.connectAsync(
    env.get("MQTT_BROKER").required().asString(),
    {
      username: env.get("MQTT_USERNAME").asString(),
      password: env.get("MQTT_PASSWORD").asString(),
    },
  );

  console.log("mqtt-client: connected");

  await client.subscribeAsync(
    entities.map((entity) => getTopic(entity, TopicType.COMMAND)),
  );

  // 受信して状態を変更
  const handleMessage = async (topic: string, message: string) => {
    const entity = entities.find(
      (entity) => getTopic(entity, TopicType.COMMAND) === topic,
    );
    if (!entity) return;
    const jema = jemas.get(entity.uniqueId)!;

    const monitor = await jema.getMonitor();
    if (
      (message === StatusMessage.ACTIVE && !monitor) ||
      (message === StatusMessage.INACTIVE && monitor)
    ) {
      await jema.sendControl();
    }
  };
  client.on("message", (topic, payload) => {
    void handleMessage(topic, payload.toString());
  });

  await Promise.all(
    entities.map(async (entity) => {
      const publishState = (value: boolean) =>
        client.publishAsync(
          getTopic(entity, TopicType.STATE),
          value ? StatusMessage.ACTIVE : StatusMessage.INACTIVE,
          { retain: true },
        );
      const jema = jemas.get(entity.uniqueId)!;
      // 状態の変更を検知して送信
      jema.setMonitorListener((value) => void publishState(value));
      // 起動時に送信
      await publishState(await jema.getMonitor());
      // Home Assistantでデバイスを検出
      await client.publishAsync(
        `${haDiscoveryPrefix}/${entity.component}/${deviceId}/${entity.uniqueId}/config`,
        getDiscoveryMessage(entity),
        { retain: true },
      );
    }),
  );

  const publishAvailability = (value: string) =>
    Promise.all(
      entities.map((entity) =>
        client.publishAsync(getTopic(entity, TopicType.AVAILABILITY), value),
      ),
    );

  // オンライン状態を定期的に送信
  const availabilityTimerId = setInterval(
    () => void publishAvailability("online"),
    env.get("AVAILABILITY_INTERVAL").default(10000).asIntPositive(),
  );

  const shutdownHandler = async () => {
    console.log("jema2mqtt: shutdown");
    clearInterval(availabilityTimerId);
    await publishAvailability("offline");
    await client.endAsync();
    console.log("mqtt-client: closed");
    await Promise.all(Array.from(jemas.values()));
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdownHandler());
  process.on("SIGTERM", () => void shutdownHandler());

  await publishAvailability("online");

  console.log("jema2mqtt: ready");
}

main().catch((error) => {
  console.error("jema2mqtt:", error);
  process.exit(1);
});
