import logger from "@/logger";
import * as gpio from "@/service/gpio";
import { setTimeout } from "timers/promises";

export type JemaAccess = {
  sendControl: () => Promise<void>;
  getMonitor: () => Promise<boolean>;
  setMonitorListener: (listener: (value: boolean) => void) => Promise<void>;
};

const MONITOR_INTERVAL = 100;
const CONTROL_INTERVAL = 250;

export default function requestJemaAccess(
  controlGpio: number,
  monitorGpio: number,
): JemaAccess {
  logger.info(
    `[JEMA] GPIO settings: control=${controlGpio}, monitor=${monitorGpio}`,
  );

  const getMonitor = async () => {
    const value = await gpio.getValue(monitorGpio);
    logger.debug(`[JEMA] getMonitor: ${value}`);
    return value === 1;
  };

  return {
    sendControl: async () => {
      logger.debug("[JEMA] sendControl");
      await gpio.setValue(controlGpio, 1, {
        toggle: `${CONTROL_INTERVAL}ms,0`,
      });
    },

    getMonitor,

    setMonitorListener: async (listener: (value: boolean) => void) => {
      let currentMonitor = await getMonitor();

      void (async () => {
        while (true) {
          const monitor = await getMonitor();
          if (monitor !== currentMonitor) {
            logger.debug(`[JEMA] onchange: ${monitor}`);
            listener(monitor);
            currentMonitor = monitor;
          }
          await setTimeout(MONITOR_INTERVAL);
        }
      })();
    },
  };
}
