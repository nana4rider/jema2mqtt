import { Entity } from "@/entity";
import logger from "@/logger";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { getTopic, TopicType } from "@/payload/topic";
import initializeHttpServer from "@/service/http";
import requestJemaAccess from "@/service/jema";
import initializeMqttClient from "@/service/mqtt";
import env from "env-var";
import fs from "fs/promises";

type Config = {
  deviceId: string;
  entities: Entity[];
};

const HA_DISCOVERY_PREFIX = env
  .get("HA_DISCOVERY_PREFIX")
  .default("homeassistant")
  .asString();
const AVAILABILITY_INTERVAL = env
  .get("AVAILABILITY_INTERVAL")
  .default(10000)
  .asIntPositive();

async function main() {
  logger.info("start");

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as Config;

  const origin = await buildOrigin();
  const device = buildDevice(deviceId);

  const jemas = new Map(
    await Promise.all(
      entities.map(async ({ id: uniqueId, controlGpio, monitorGpio }) => {
        const jema = await requestJemaAccess(controlGpio, monitorGpio);
        return [uniqueId, jema] as const;
      }),
    ),
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

  const subscribeTopics = entities.map((entity) => {
    const topic = getTopic(entity, TopicType.COMMAND);
    return topic;
  });

  const mqtt = await initializeMqttClient(subscribeTopics, handleMessage);

  await Promise.all(
    entities.map(async (entity) => {
      const publishState = (value: boolean) =>
        mqtt.publish(
          getTopic(entity, TopicType.STATE),
          value ? StatusMessage.ACTIVE : StatusMessage.INACTIVE,
          { retain: true },
        );
      const jema = jemas.get(entity.id)!;
      // 状態の変更を検知して送信
      jema.setMonitorListener((value) => void publishState(value));
      // 起動時に送信
      publishState(await jema.getMonitor());
      // Home Assistantでデバイスを検出
      const discoveryMessage = {
        ...buildEntity(deviceId, entity),
        ...device,
        ...origin,
      };
      mqtt.publish(
        `${HA_DISCOVERY_PREFIX}/${entity.domain}/${discoveryMessage.unique_id}/config`,
        JSON.stringify(discoveryMessage),
        { qos: 1, retain: true },
      );
    }),
  );

  const publishAvailability = (value: string) => {
    entities.forEach((entity) =>
      mqtt.publish(getTopic(entity, TopicType.AVAILABILITY), value),
    );
  };

  // オンライン状態を定期的に送信
  const availabilityTimerId = setInterval(
    () => void publishAvailability("online"),
    AVAILABILITY_INTERVAL,
  );

  const http = await initializeHttpServer();
  http.setEndpoint("/health", () => ({}));

  const shutdownHandler = async () => {
    logger.info("shutdown");
    clearInterval(availabilityTimerId);
    publishAvailability("offline");
    await mqtt.close(true);
    await http.close();
    await Promise.all(Array.from(jemas.values()).map((jema) => jema.close()));
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdownHandler());
  process.on("SIGTERM", () => void shutdownHandler());

  publishAvailability("online");

  logger.info("ready");
}

try {
  await main();
} catch (err) {
  logger.error("main() error:", err);
  process.exit(1);
}
