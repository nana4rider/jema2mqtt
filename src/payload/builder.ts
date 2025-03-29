import type { Entity } from "@/entity";
import env from "@/env";
import { getTopic, TopicType } from "@/payload/topic";
import {
  homepage as packageHomepage,
  name as packageName,
  version as packageVersion,
} from "package.json";
import type { JsonObject } from "type-fest";

export type Payload = JsonObject;

export const StatusMessage = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
type StatusMessage = (typeof StatusMessage)[keyof typeof StatusMessage];

export function buildEntity(
  deviceId: string,
  entity: Entity,
): Readonly<Payload & { unique_id: string }> {
  const baseMessage = {
    unique_id: `jema2mqtt_${deviceId}_${entity.id}`,
    name: entity.name,
    command_topic: getTopic(deviceId, entity, TopicType.COMMAND),
    state_topic: getTopic(deviceId, entity, TopicType.STATE),
    availability_topic: getTopic(deviceId, entity, TopicType.AVAILABILITY),
    optimistic: false,
    qos: env.ENTITY_QOS,
    retain: false,
  };

  const { domain } = entity;
  if (domain === "lock") {
    return {
      ...baseMessage,
      payload_lock: StatusMessage.ACTIVE,
      payload_unlock: StatusMessage.INACTIVE,
      state_locked: StatusMessage.ACTIVE,
      state_unlocked: StatusMessage.INACTIVE,
    } as const;
  } else if (domain === "switch") {
    return {
      ...baseMessage,
      payload_on: StatusMessage.ACTIVE,
      payload_off: StatusMessage.INACTIVE,
      state_on: StatusMessage.ACTIVE,
      state_off: StatusMessage.INACTIVE,
    } as const;
  } else if (domain === "cover") {
    return {
      ...baseMessage,
      payload_close: StatusMessage.ACTIVE,
      payload_open: StatusMessage.INACTIVE,
      state_closed: StatusMessage.ACTIVE,
      state_open: StatusMessage.INACTIVE,
    } as const;
  }

  throw new Error(`unknown domain: ${entity.domain}`);
}

export function buildDevice(deviceId: string): Readonly<Payload> {
  return {
    device: {
      identifiers: [`jema2mqtt_${deviceId}`],
      name: `jema2mqtt.${deviceId}`,
      model: `jema2mqtt`,
      manufacturer: "nana4rider",
    },
  };
}

export function buildOrigin(): Readonly<Payload> {
  const origin: Payload = {};
  if (typeof packageName === "string") origin.name = packageName;
  if (typeof packageVersion === "string") origin.sw_version = packageVersion;
  if (typeof packageHomepage === "string") origin.support_url = packageHomepage;
  return { origin };
}
