import type { Entity } from "@/entity";
import logger from "@/logger";
import { setupAvailability } from "@/manager/availabilityManager";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import initializeHttpServer from "@/service/http";
import type { JemaAccess } from "@/service/jema";
import createJemaAccess from "@/service/jema";
import fs from "fs/promises";

export type DeviceConfig = {
  deviceId: string;
  entities: Entity[];
};

async function main() {
  logger.info("start");

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as DeviceConfig;
  const jemas = new Map<string, JemaAccess>();
  for (const { id, controlGpio, monitorGpio } of entities) {
    jemas.set(id, createJemaAccess(controlGpio, monitorGpio));
  }
  const mqtt = await setupMqttDeviceManager(deviceId, entities, jemas);
  const http = await initializeHttpServer();
  const availability = setupAvailability(deviceId, entities, mqtt);

  const handleShutdown = async () => {
    logger.info("shutdown");
    availability.close();
    await mqtt.close(true);
    await http.close();
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
