import { Entity } from "@/entity";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { getTopic, TopicType } from "@/payload/topic";
import { JemaAccess } from "@/service/jema";
import initializeMqttClient from "@/service/mqtt";
import env from "env-var";

const HA_DISCOVERY_PREFIX = env
  .get("HA_DISCOVERY_PREFIX")
  .default("homeassistant")
  .asString();

export default async function setupMqttDeviceManager(
  deviceId: string,
  entities: Entity[],
  jemas: Map<string, JemaAccess>,
) {
  const origin = await buildOrigin();
  const device = buildDevice(deviceId);

  // 受信して状態を変更
  const handleMessage = async (topic: string, message: string) => {
    const entity = entities.find(
      (entity) => getTopic(entity, TopicType.COMMAND) === topic,
    );
    if (!entity) return;
    const jema = jemas.get(entity.id)!;

    const monitor = await jema.getMonitor();
    if (
      (message === StatusMessage.ACTIVE && !monitor) ||
      (message === StatusMessage.INACTIVE && monitor)
    ) {
      await jema.sendControl();
    }
  };

  const subscribeTopics = entities.map((entity) => {
    const topic = getTopic(entity, TopicType.COMMAND);
    return topic;
  });

  const mqtt = await initializeMqttClient(subscribeTopics, handleMessage);

  await Promise.all(
    entities.map(async (entity) => {
      const publishState = (value: boolean) =>
        mqtt.publish(
          getTopic(entity, TopicType.STATE),
          value ? StatusMessage.ACTIVE : StatusMessage.INACTIVE,
          { retain: true },
        );
      const jema = jemas.get(entity.id)!;
      // 状態の変更を検知して送信
      jema.setMonitorListener((value) => void publishState(value));
      // 起動時に送信
      publishState(await jema.getMonitor());
      // Home Assistantでデバイスを検出
      const discoveryMessage = {
        ...buildEntity(deviceId, entity),
        ...device,
        ...origin,
      };
      mqtt.publish(
        `${HA_DISCOVERY_PREFIX}/${entity.domain}/${discoveryMessage.unique_id}/config`,
        JSON.stringify(discoveryMessage),
        { qos: 1, retain: true },
      );
    }),
  );

  return mqtt;
}
