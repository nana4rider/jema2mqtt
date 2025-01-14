import { Entity } from "@/entity";

export const TopicType = {
  COMMAND: "set",
  STATE: "state",
  AVAILABILITY: "availability",
} as const;
type TopicType = (typeof TopicType)[keyof typeof TopicType];

export function getTopic(entity: Entity, type: TopicType): string {
  return `jema2mqtt/${entity.id}/${type}`;
}
