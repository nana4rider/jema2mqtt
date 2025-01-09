import { Entity } from "@/entity";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { TopicType } from "@/payload/topic";

describe("buildEntity", () => {
  test("lockに必要な属性が揃っている", () => {
    const mockEntity = {
      id: "entity1",
      name: "Test Entity",
      domain: "lock",
    } as Entity;

    const entity = buildEntity("deviceId1", mockEntity);

    expect(entity).toHaveProperty("unique_id", "jema2mqtt_deviceId1_entity1");
    expect(entity).toHaveProperty("name", "Test Entity");
    expect(entity).toHaveProperty(
      "command_topic",
      `jema2mqtt/entity1/${TopicType.COMMAND}`,
    );
    expect(entity).toHaveProperty(
      "state_topic",
      `jema2mqtt/entity1/${TopicType.STATE}`,
    );
    expect(entity).toHaveProperty(
      "availability_topic",
      `jema2mqtt/entity1/${TopicType.AVAILABILITY}`,
    );
    expect(entity).toHaveProperty("payload_lock", StatusMessage.ACTIVE);
    expect(entity).toHaveProperty("payload_unlock", StatusMessage.INACTIVE);
    expect(entity).toHaveProperty("state_locked", StatusMessage.ACTIVE);
    expect(entity).toHaveProperty("state_unlocked", StatusMessage.INACTIVE);
    expect(entity).toHaveProperty("optimistic", false);
    expect(entity).toHaveProperty("qos");
    expect(entity).toHaveProperty("retain", false);
  });

  test("switchに必要な属性が揃っている", () => {
    const mockEntity = {
      id: "entity1",
      name: "Test Entity",
      domain: "switch",
    } as Entity;

    const entity = buildEntity("deviceId1", mockEntity);

    expect(entity).toHaveProperty("unique_id", "jema2mqtt_deviceId1_entity1");
    expect(entity).toHaveProperty("name", "Test Entity");
    expect(entity).toHaveProperty(
      "command_topic",
      `jema2mqtt/entity1/${TopicType.COMMAND}`,
    );
    expect(entity).toHaveProperty(
      "state_topic",
      `jema2mqtt/entity1/${TopicType.STATE}`,
    );
    expect(entity).toHaveProperty(
      "availability_topic",
      `jema2mqtt/entity1/${TopicType.AVAILABILITY}`,
    );
    expect(entity).toHaveProperty("payload_on", StatusMessage.ACTIVE);
    expect(entity).toHaveProperty("payload_off", StatusMessage.INACTIVE);
    expect(entity).toHaveProperty("state_on", StatusMessage.ACTIVE);
    expect(entity).toHaveProperty("state_off", StatusMessage.INACTIVE);
    expect(entity).toHaveProperty("optimistic", false);
    expect(entity).toHaveProperty("qos");
    expect(entity).toHaveProperty("retain", false);
  });

  test("coverに必要な属性が揃っている", () => {
    const mockEntity = {
      id: "entity1",
      name: "Test Entity",
      domain: "cover",
    } as Entity;

    const entity = buildEntity("deviceId1", mockEntity);

    expect(entity).toHaveProperty("unique_id", "jema2mqtt_deviceId1_entity1");
    expect(entity).toHaveProperty("name", "Test Entity");
    expect(entity).toHaveProperty(
      "command_topic",
      `jema2mqtt/entity1/${TopicType.COMMAND}`,
    );
    expect(entity).toHaveProperty(
      "state_topic",
      `jema2mqtt/entity1/${TopicType.STATE}`,
    );
    expect(entity).toHaveProperty(
      "availability_topic",
      `jema2mqtt/entity1/${TopicType.AVAILABILITY}`,
    );
    expect(entity).toHaveProperty("payload_close", StatusMessage.ACTIVE);
    expect(entity).toHaveProperty("payload_open", StatusMessage.INACTIVE);
    expect(entity).toHaveProperty("state_closed", StatusMessage.ACTIVE);
    expect(entity).toHaveProperty("state_open", StatusMessage.INACTIVE);
    expect(entity).toHaveProperty("optimistic", false);
    expect(entity).toHaveProperty("qos");
    expect(entity).toHaveProperty("retain", false);
  });

  test("不明なドメイン", () => {
    const mockEntity = {
      id: "entity1",
      name: "Test Entity",
      domain: "unknown" as unknown,
    } as Entity;

    const actual = () => buildEntity("deviceId1", mockEntity);

    expect(actual).toThrow();
  });
});

describe("device", () => {
  test("必要な属性が揃っている", () => {
    const device = buildDevice("deviceId1");
    expect(device).toHaveProperty("device.identifiers");
    expect(device).toHaveProperty("device.name");
    expect(device).toHaveProperty("device.model");
    expect(device).toHaveProperty("device.manufacturer");
  });
});

describe("origin", () => {
  test("必要な属性が揃っている", async () => {
    const origin = await buildOrigin();
    expect(origin).toHaveProperty("origin.name");
    expect(origin).toHaveProperty("origin.sw_version");
    expect(origin).toHaveProperty("origin.support_url");
  });
});
