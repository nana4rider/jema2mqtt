import type { Entity } from "@/entity";
import logger from "@/logger";
import { setupAvailability } from "@/manager/availabilityManager";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import initializeHttpServer from "@/service/http";
import requestJemaAccess from "@/service/jema";
import fs from "fs/promises";

type Config = {
  deviceId: string;
  entities: Entity[];
};

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
  const availability = setupAvailability(deviceId, entities, mqtt);

  const handleShutdown = async () => {
    logger.info("shutdown");
    availability.close();
    await mqtt.close(true);
    await http.close();
    await Promise.all(Array.from(jemas.values()).map((jema) => jema.close()));
    process.exit(0);
  };

  process.on("SIGINT", () => void handleShutdown());
  process.on("SIGTERM", () => void handleShutdown());

  availability.pushOnline();

  logger.info("ready");
}

try {
  await main();
} catch (err) {
  logger.error("main() error:", err);
  process.exit(1);
}
