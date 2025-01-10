import logger from "@/logger";
import { requestGPIOAccess } from "node-web-gpio";
import { setTimeout as sleep } from "timers/promises";

export type JemaAccess = {
  sendControl: () => Promise<void>;
  getMonitor: () => Promise<boolean>;
  setMonitorListener: (listener: (value: boolean) => void) => void;
  close: () => Promise<void>;
};

const CONTROL_INTERVAL = 250;

export default async function requestJemaAccess(
  controlGpio: number,
  monitorGpio: number,
): Promise<JemaAccess> {
  const gpioAccess = await requestGPIOAccess();

  const controlPort = gpioAccess.ports.get(controlGpio);
  if (!controlPort) {
    throw new Error(`GPIO(${controlGpio}) initialization failed.`);
  }

  await controlPort.export("out");

  const monitorPort = gpioAccess.ports.get(monitorGpio);
  if (!monitorPort) {
    throw new Error(`GPIO(${monitorGpio}) initialization failed.`);
  }

  await monitorPort.export("in");

  logger.info(`[JEMA] initialized`, { controlGpio, monitorGpio });

  return {
    sendControl: async () => {
      logger.debug("[JEMA] sendControl");
      await controlPort.write(1);
      await sleep(CONTROL_INTERVAL);
      await controlPort.write(0);
    },

    getMonitor: async () => {
      const value = await monitorPort.read();
      logger.debug(`[JEMA] getMonitor: ${value}`);
      return value === 1;
    },

    setMonitorListener: (listener: (value: boolean) => void) => {
      monitorPort.onchange = ({ value }) => {
        logger.debug(`[JEMA] onchange: ${value}`);
        return listener(value === 1);
      };
    },

    close: async () => {
      for (const port of [controlPort, monitorPort]) {
        const { portNumber: gpio } = port;
        try {
          await port.unexport();
          logger.info(`[JEMA] GPIO(${gpio}) successfully unexported.`);
        } catch (error) {
          logger.error(`[JEMA] Failed to unexport GPIO(${gpio}):`, error);
        }
      }
    },
  };
}
