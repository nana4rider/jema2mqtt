import logger from "@/logger";
import { GPIOValue, getGPIOValue, setGPIOValue } from "@/service/gpio";
import { setTimeout } from "timers/promises";

export type JemaAccess = {
  sendControlPulse: () => Promise<void>;
  readMonitor: () => Promise<boolean>;
  onMonitorChange: (listener: (value: boolean) => void) => void;
};

const MONITOR_INTERVAL = 100;
const CONTROL_INTERVAL = 250;

export default function createJemaAccess(
  controlGpio: number,
  monitorGpio: number,
): JemaAccess {
  logger.info(
    `[JEMA] GPIO settings: control=${controlGpio}, monitor=${monitorGpio}`,
  );

  const readMonitor = async () => {
    const value = await getGPIOValue(monitorGpio);
    logger.silly(`[JEMA] readMonitor: ${value}`);
    return value === GPIOValue.ACTIVE;
  };

  return {
    sendControlPulse: async () => {
      logger.debug("[JEMA] sendControlPulse");
      await setGPIOValue(controlGpio, GPIOValue.ACTIVE, {
        toggle: `${CONTROL_INTERVAL}ms,0`,
      });
    },

    readMonitor,

    onMonitorChange: (listener: (value: boolean) => void) => {
      void (async () => {
        let currentMonitor = await readMonitor();

        while (true) {
          try {
            const monitor = await readMonitor();
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
