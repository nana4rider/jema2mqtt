import { Entity } from "@/entity";
import requestJemaAccess from "@/jema";
import logger from "@/logger";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { getTopic, TopicType } from "@/payload/topic";
import env from "env-var";
import fs from "fs/promises";
import http from "http";
import mqtt from "mqtt";
import { promisify } from "util";

type Config = {
  deviceId: string;
  entities: Entity[];
};

const HA_DISCOVERY_PREFIX = env
  .get("HA_DISCOVERY_PREFIX")
  .default("homeassistant")
  .asString();
const PORT = env.get("PORT").default(3000).asPortNumber();
const MQTT_BROKER = env.get("MQTT_BROKER").required().asString();
const MQTT_USERNAME = env.get("MQTT_USERNAME").asString();
const MQTT_PASSWORD = env.get("MQTT_PASSWORD").asString();
const AVAILABILITY_INTERVAL = env
  .get("AVAILABILITY_INTERVAL")
  .default(10000)
  .asIntPositive();

async function main() {
  logger.info("start");

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as Config;

  const jemas = new Map(
    await Promise.all(
      entities.map(async ({ id: uniqueId, controlGpio, monitorGpio }) => {
        const jema = await requestJemaAccess(controlGpio, monitorGpio);
        return [uniqueId, jema] as const;
      }),
    ),
  );

  const origin = await buildOrigin();
  const device = buildDevice(deviceId);

  const client = await mqtt.connectAsync(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  logger.info("[MQTT] connected");

  await client.subscribeAsync(
    entities.map((entity) => {
      const topic = getTopic(entity, TopicType.COMMAND);
      logger.debug(`subscribe: ${topic}`);
      return topic;
    }),
  );

  // 受信して状態を変更
  const handleMessage = async (topic: string, message: string) => {
    const entity = entities.find(
      (entity) => getTopic(entity, TopicType.COMMAND) === topic,
    );
    if (!entity) return;
    const jema = jemas.get(entity.id)!;

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
      const jema = jemas.get(entity.id)!;
      // 状態の変更を検知して送信
      jema.setMonitorListener((value) => void publishState(value));
      // 起動時に送信
      await publishState(await jema.getMonitor());
      // Home Assistantでデバイスを検出
      const discoveryMessage = {
        ...buildEntity(deviceId, entity),
        ...device,
        ...origin,
      };
      await client.publishAsync(
        `${HA_DISCOVERY_PREFIX}/${entity.domain}/${discoveryMessage.unique_id}/config`,
        JSON.stringify(discoveryMessage),
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
    AVAILABILITY_INTERVAL,
  );

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({}));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await promisify(server.listen.bind(server, PORT))();
  logger.info(`Health check server running on port ${PORT}`);

  const shutdownHandler = async () => {
    logger.info("shutdown");
    await promisify(server.close.bind(server))();
    logger.info("[HTTP] closed");
    clearInterval(availabilityTimerId);
    await publishAvailability("offline");
    await client.endAsync();
    logger.info("[MQTT] closed");
    await Promise.all(Array.from(jemas.values()).map((jema) => jema.close()));
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdownHandler());
  process.on("SIGTERM", () => void shutdownHandler());

  await publishAvailability("online");

  logger.info("ready");
}

try {
  await main();
} catch (err) {
  logger.error("main() error:", err);
  process.exit(1);
}
