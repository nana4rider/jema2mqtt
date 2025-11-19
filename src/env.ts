import { cleanEnv, num, port, str, testOnly } from "envalid";

const env = cleanEnv(process.env, {
  MQTT_BROKER: str({
    desc: "MQTTブローカー",
    example: "mqtt://localhost",
    devDefault: testOnly("mqtt://mqtt-broker"),
  }),
  MQTT_USERNAME: str({
    desc: "MQTTユーザ名",
    default: undefined,
    devDefault: testOnly("test-user"),
  }),
  MQTT_PASSWORD: str({
    desc: "MQTTパスワード",
    default: undefined,
    devDefault: testOnly("test-password"),
  }),
  MQTT_TASK_INTERVAL: num({ desc: "MQTTタスク実行間隔", default: 100 }),
  ENTITY_QOS: num({
    desc: "エンティティのQOS設定",
    choices: [0, 1, 2],
    default: 1,
  }),
  LOG_LEVEL: str({ desc: "ログレベル", default: "info" }),
  HA_DISCOVERY_PREFIX: str({
    desc: "https://www.home-assistant.io/integrations/mqtt/#discovery-options",
    default: "homeassistant",
  }),
  PORT: port({
    desc: "HTTPサーバーのポート",
    default: 3000,
    devDefault: testOnly(0),
  }),
  AVAILABILITY_INTERVAL: num({
    desc: "オンライン状態を送信する間隔",
    default: 10000,
  }),
  GPIO_CHIP: num({ desc: "GPIOチップ", default: 0 }),
});

export default env;
