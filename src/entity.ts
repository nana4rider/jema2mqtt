export type Entity = {
  id: string;
  name: string;
  domain: EntityDomain;
  controlGpio: number;
  monitorGpio: number;
};

export type EntityDomain = "lock" | "switch" | "cover";
