"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requestJemaAccess;
const node_web_gpio_1 = require("node-web-gpio");
const promises_1 = require("timers/promises");
const CONTROL_INTERVAL = 250;
async function requestJemaAccess(controlGpio, monitorGpio) {
    const gpioAccess = await (0, node_web_gpio_1.requestGPIOAccess)();
    const controlPort = gpioAccess.ports.get(controlGpio);
    if (!controlPort)
        throw new Error(`controlPin(${controlGpio}) initialization failed.`);
    await controlPort.export("out");
    const monitorPort = gpioAccess.ports.get(monitorGpio);
    if (!monitorPort)
        throw new Error(`monitorPin(${monitorGpio}) initialization failed.`);
    await monitorPort.export("in");
    console.log(`jema: initialized`, { controlGpio, monitorGpio });
    return {
        sendControl: async () => {
            await controlPort.write(1);
            await (0, promises_1.setTimeout)(CONTROL_INTERVAL);
            await controlPort.write(0);
        },
        getMonitor: async () => (await monitorPort.read()) === 1,
        setMonitorListener: (listener) => {
            monitorPort.onchange = ({ value }) => listener(value === 1);
        },
    };
}
