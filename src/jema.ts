import { requestGPIOAccess } from "node-web-gpio";
import { setTimeout as sleep } from "timers/promises";

const CONTROL_INTERVAL = 250;

export default async function requestJemaAccess(
  controlGpio: number,
  monitorGpio: number,
) {
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

  console.log(`jema: initialized`, { controlGpio, monitorGpio });

  return {
    sendControl: async () => {
      await controlPort.write(1);
      await sleep(CONTROL_INTERVAL);
      await controlPort.write(0);
    },

    getMonitor: async () => (await monitorPort.read()) === 1,

    setMonitorListener: (listener: (value: boolean) => void) => {
      monitorPort.onchange = ({ value }) => listener(value === 1);
    },

    close: async () => {
      for (const port of [controlPort, monitorPort]) {
        const { portNumber: gpio } = port;
        try {
          await port.unexport();
          console.log(`jema: GPIO(${gpio}) successfully unexported.`);
        } catch (error) {
          console.error(`jema: Failed to unexport GPIO(${gpio}):`, error);
        }
      }
    },
  };
}
