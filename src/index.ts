import { Entity } from "@/entity";
import logger from "@/logger";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import { getTopic, TopicType } from "@/payload/topic";
import initializeHttpServer from "@/service/http";
import requestJemaAccess from "@/service/jema";
import env from "env-var";
import fs from "fs/promises";

type Config = {
  deviceId: string;
  entities: Entity[];
};

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
  const mqtt = await setupMqttDeviceManager(deviceId, entities, jemas);
  const http = await initializeHttpServer();

  http.setEndpoint("/health", () => ({}));

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
