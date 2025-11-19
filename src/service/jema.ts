import logger from "@/logger";
import { GPIOValue, getGPIOValue, setGPIOValue } from "@/service/gpio";
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
    const value = await getGPIOValue(monitorGpio);
    logger.silly(`[JEMA] getMonitor: ${value}`);
    return value === GPIOValue.ACTIVE;
  };

  return {
    sendControl: async () => {
      logger.debug("[JEMA] sendControl");
      await setGPIOValue(controlGpio, GPIOValue.ACTIVE, {
        toggle: `${CONTROL_INTERVAL}ms,0`,
      });
    },

    getMonitor,

    setMonitorListener: async (listener: (value: boolean) => void) => {
      let currentMonitor = await getMonitor();

      void (async () => {
        while (true) {
          try {
            const monitor = await getMonitor();
            if (monitor !== currentMonitor) {
              logger.debug(`[JEMA] onchange: ${monitor}`);
              listener(monitor);
              currentMonitor = monitor;
            }
          } catch (err) {
            logger.error("[JEMA] monitor error:", err);
          }
          await setTimeout(MONITOR_INTERVAL);
        }
      })();
    },
  };
}
