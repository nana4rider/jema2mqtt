"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jema_1 = __importDefault(require("./jema"));
const mqtt_1 = __importDefault(require("mqtt"));
const env_var_1 = __importDefault(require("env-var"));
const promises_1 = __importDefault(require("fs/promises"));
const MESSAGE_ACTIVE = "ACTIVE";
const MESSAGE_INACTIVE = "INACTIVE";
var TopicType;
(function (TopicType) {
    TopicType["COMMAND"] = "set";
    TopicType["STATE"] = "state";
    TopicType["AVAILABILITY"] = "availability";
})(TopicType || (TopicType = {}));
function getTopic(device, type) {
    return `jema-mqtt/${device.uniqueId}/${type}`;
}
async function main() {
    console.log("jema-mqtt: start");
    const haDiscoveryPrefix = env_var_1.default
        .get("HA_DISCOVERY_PREFIX")
        .default("homeassistant")
        .asString();
    const { deviceId, entities } = JSON.parse(await promises_1.default.readFile("./config.json", "utf-8"));
    const getDiscoveryMessage = (entity) => {
        const deviceInfo = {
            identifiers: [deviceId],
            name: `jema-mqtt.${deviceId}`,
            model: "jema-mqtt",
            manufacturer: "nana4rider",
        };
        if (entity.component === "lock") {
            return JSON.stringify({
                unique_id: entity.uniqueId,
                name: entity.name,
                command_topic: getTopic(entity, TopicType.COMMAND),
                state_topic: getTopic(entity, TopicType.STATE),
                availability_topic: getTopic(entity, TopicType.AVAILABILITY),
                payload_lock: MESSAGE_ACTIVE,
                payload_unlock: MESSAGE_INACTIVE,
                state_locked: MESSAGE_ACTIVE,
                state_unlocked: MESSAGE_INACTIVE,
                optimistic: false,
                retain: true,
                device: deviceInfo,
            });
        }
        throw new Error(`unknown type: ${entity.component}`);
    };
    const jemas = await Promise.all(entities.map((entity) => (0, jema_1.default)(entity.controlGpio, entity.monitorGpio)));
    const client = mqtt_1.default.connect(env_var_1.default.get("MQTT_BROKER").required().asString(), {
        username: env_var_1.default.get("MQTT_USERNAME").asString(),
        password: env_var_1.default.get("MQTT_PASSWORD").asString(),
    });
    await new Promise((resolve, reject) => {
        client.on("connect", () => {
            console.log("mqtt: connected");
            entities.forEach((entity) => {
                client.subscribe(getTopic(entity, TopicType.COMMAND), (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                });
            });
            resolve();
        });
        client.on("error", reject);
    });
    // 受信して状態を変更
    client.on("message", async (topic, payload) => {
        const entityIndex = entities.findIndex((entity) => getTopic(entity, TopicType.COMMAND) === topic);
        if (entityIndex === -1)
            return;
        const message = payload.toString();
        const monitor = await jemas[entityIndex].getMonitor();
        if ((message === MESSAGE_ACTIVE && !monitor) ||
            (message === MESSAGE_INACTIVE && monitor)) {
            await jemas[entityIndex].sendControl();
        }
    });
    entities.map(async (entity, index) => {
        const publishState = async (value) => {
            await client.publishAsync(getTopic(entity, TopicType.STATE), value ? MESSAGE_ACTIVE : MESSAGE_INACTIVE, { retain: true });
        };
        const jema = jemas[index];
        // 状態の変更を検知して送信
        jema.setMonitorListener(publishState);
        // 起動時に送信
        await publishState(await jema.getMonitor());
        // Home Assistantでデバイスを検出
        await client.publishAsync(`${haDiscoveryPrefix}/${entity.component}/${deviceId}/${entity.uniqueId}/config`, getDiscoveryMessage(entity));
    });
    const publishAvailability = async (value) => {
        await Promise.all(entities.map((entity) => client.publishAsync(getTopic(entity, TopicType.AVAILABILITY), value)));
    };
    // オンライン状態を定期的に送信
    const timerId = setInterval(() => {
        publishAvailability('online');
    }, env_var_1.default.get("AVAILABILITY_INTERVAL").default(10000).asIntPositive());
    const shutdownHandler = async () => {
        console.log("jema-mqtt: shutdown");
        clearInterval(timerId);
        await publishAvailability('offline');
        process.exit(0);
    };
    process.on("SIGINT", shutdownHandler); // Ctrl+C
    process.on("SIGTERM", shutdownHandler); // kill コマンドやシステム停止
    await publishAvailability('online');
    console.log("jema-mqtt: ready");
}
main();
