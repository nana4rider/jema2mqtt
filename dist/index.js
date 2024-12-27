"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jema_1 = __importDefault(require("./jema"));
const mqtt_1 = __importDefault(require("mqtt"));
const env_var_1 = __importDefault(require("env-var"));
const promises_1 = __importDefault(require("fs/promises"));
const TopicType = {
    COMMAND: "set",
    STATE: "state",
    AVAILABILITY: "availability",
};
const StatusMessage = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
};
function getTopic(device, type) {
    return `jema2mqtt/${device.uniqueId}/${type}`;
}
async function main() {
    console.log("jema2mqtt: start");
    const haDiscoveryPrefix = env_var_1.default
        .get("HA_DISCOVERY_PREFIX")
        .default("homeassistant")
        .asString();
    const { deviceId, entities } = JSON.parse(await promises_1.default.readFile("./config.json", "utf-8"));
    const getDiscoveryMessage = (entity) => {
        const createMessage = (obj) => JSON.stringify({
            unique_id: entity.uniqueId,
            name: entity.name,
            optimistic: false,
            device: {
                identifiers: [deviceId],
                name: `jema2mqtt.${deviceId}`,
                model: "jema2mqtt",
                manufacturer: "nana4rider",
            },
            ...obj,
        });
        const { component } = entity;
        if (component === "lock" || component === "switch") {
            return createMessage({
                command_topic: getTopic(entity, TopicType.COMMAND),
                state_topic: getTopic(entity, TopicType.STATE),
                availability_topic: getTopic(entity, TopicType.AVAILABILITY),
                payload_lock: StatusMessage.ACTIVE,
                payload_unlock: StatusMessage.INACTIVE,
                state_locked: StatusMessage.ACTIVE,
                state_unlocked: StatusMessage.INACTIVE,
            });
        }
        throw new Error(`unknown component: ${entity.component}`);
    };
    const jemas = await Promise.all(entities.map((entity) => (0, jema_1.default)(entity.controlGpio, entity.monitorGpio)));
    const client = await mqtt_1.default.connectAsync(env_var_1.default.get("MQTT_BROKER").required().asString(), {
        username: env_var_1.default.get("MQTT_USERNAME").asString(),
        password: env_var_1.default.get("MQTT_PASSWORD").asString(),
    });
    console.log("mqtt-client: connected");
    await client.subscribeAsync(entities.map((entity) => getTopic(entity, TopicType.COMMAND)));
    // 受信して状態を変更
    client.on("message", (topic, payload) => {
        void (async () => {
            const entityIndex = entities.findIndex((entity) => getTopic(entity, TopicType.COMMAND) === topic);
            if (entityIndex === -1)
                return;
            const message = payload.toString();
            const monitor = await jemas[entityIndex].getMonitor();
            if ((message === StatusMessage.ACTIVE && !monitor) ||
                (message === StatusMessage.INACTIVE && monitor)) {
                await jemas[entityIndex].sendControl();
            }
        })();
    });
    await Promise.all(entities.map(async (entity, index) => {
        const publishState = (value) => client.publishAsync(getTopic(entity, TopicType.STATE), value ? StatusMessage.ACTIVE : StatusMessage.INACTIVE, { retain: true });
        const jema = jemas[index];
        // 状態の変更を検知して送信
        jema.setMonitorListener((value) => void publishState(value));
        // 起動時に送信
        await publishState(await jema.getMonitor());
        // Home Assistantでデバイスを検出
        await client.publishAsync(`${haDiscoveryPrefix}/${entity.component}/${deviceId}/${entity.uniqueId}/config`, getDiscoveryMessage(entity), { retain: true });
    }));
    const publishAvailability = (value) => Promise.all(entities.map((entity) => client.publishAsync(getTopic(entity, TopicType.AVAILABILITY), value)));
    // オンライン状態を定期的に送信
    const availabilityTimerId = setInterval(() => void publishAvailability("online"), env_var_1.default.get("AVAILABILITY_INTERVAL").default(10000).asIntPositive());
    const shutdownHandler = async () => {
        console.log("jema2mqtt: shutdown");
        clearInterval(availabilityTimerId);
        await publishAvailability("offline");
        await client.endAsync();
        console.log("mqtt-client: closed");
        await Promise.all(jemas.map((jema) => jema.close()));
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdownHandler());
    process.on("SIGTERM", () => void shutdownHandler());
    await publishAvailability("online");
    console.log("jema2mqtt: ready");
}
main().catch((error) => {
    console.error("jema2mqtt:", error);
    process.exit(1);
});
