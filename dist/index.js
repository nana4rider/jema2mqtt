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
    return `jema2mqtt/${device.id}/${type}`;
}
async function main() {
    console.log("jema2mqtt: start");
    const haDiscoveryPrefix = env_var_1.default
        .get("HA_DISCOVERY_PREFIX")
        .default("homeassistant")
        .asString();
    const { deviceId, entities } = JSON.parse(await promises_1.default.readFile("./config.json", "utf-8"));
    const getDiscoveryMessage = (entity) => {
        const baseMessage = {
            unique_id: `jema2mqtt_${deviceId}_${entity.id}`,
            name: entity.name,
            optimistic: false,
            device: {
                identifiers: [`jema2mqtt_${deviceId}`],
                name: `jema2mqtt.${deviceId}`,
                model: `jema2mqtt`,
                manufacturer: "nana4rider",
            },
            origin: {
                name: "jema2mqtt",
                sw_version: "1.0.0",
                support_url: "https://github.com/nana4rider/jema2mqtt",
            },
        };
        const { domain } = entity;
        if (domain === "lock" || domain === "switch") {
            return {
                ...baseMessage,
                command_topic: getTopic(entity, TopicType.COMMAND),
                state_topic: getTopic(entity, TopicType.STATE),
                availability_topic: getTopic(entity, TopicType.AVAILABILITY),
                payload_lock: StatusMessage.ACTIVE,
                payload_unlock: StatusMessage.INACTIVE,
                state_locked: StatusMessage.ACTIVE,
                state_unlocked: StatusMessage.INACTIVE,
            };
        }
        throw new Error(`unknown domain: ${entity.domain}`);
    };
    const jemas = new Map(await Promise.all(entities.map(async ({ id: uniqueId, controlGpio, monitorGpio }) => {
        const jema = await (0, jema_1.default)(controlGpio, monitorGpio);
        return [uniqueId, jema];
    })));
    const client = await mqtt_1.default.connectAsync(env_var_1.default.get("MQTT_BROKER").required().asString(), {
        username: env_var_1.default.get("MQTT_USERNAME").asString(),
        password: env_var_1.default.get("MQTT_PASSWORD").asString(),
    });
    console.log("mqtt-client: connected");
    await client.subscribeAsync(entities.map((entity) => getTopic(entity, TopicType.COMMAND)));
    // 受信して状態を変更
    const handleMessage = async (topic, message) => {
        const entity = entities.find((entity) => getTopic(entity, TopicType.COMMAND) === topic);
        if (!entity)
            return;
        const jema = jemas.get(entity.id);
        const monitor = await jema.getMonitor();
        if ((message === StatusMessage.ACTIVE && !monitor) ||
            (message === StatusMessage.INACTIVE && monitor)) {
            await jema.sendControl();
        }
    };
    client.on("message", (topic, payload) => {
        void handleMessage(topic, payload.toString());
    });
    await Promise.all(entities.map(async (entity) => {
        const publishState = (value) => client.publishAsync(getTopic(entity, TopicType.STATE), value ? StatusMessage.ACTIVE : StatusMessage.INACTIVE, { retain: true });
        const jema = jemas.get(entity.id);
        // 状態の変更を検知して送信
        jema.setMonitorListener((value) => void publishState(value));
        // 起動時に送信
        await publishState(await jema.getMonitor());
        // Home Assistantでデバイスを検出
        const discoveryMessage = getDiscoveryMessage(entity);
        await client.publishAsync(`${haDiscoveryPrefix}/${entity.domain}/${discoveryMessage.unique_id}/config`, JSON.stringify(discoveryMessage), { retain: true });
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
        await Promise.all(Array.from(jemas.values()));
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
