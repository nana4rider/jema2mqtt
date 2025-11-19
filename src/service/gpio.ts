import env from "@/env";
import * as child_process from "child_process";
import { promisify } from "util";

export const GPIOValue = {
  ACTIVE: 1,
  INACTIVE: 0,
} as const;
type GPIOValue = (typeof GPIOValue)[keyof typeof GPIOValue];

const exec = promisify(child_process.exec);

export async function getGPIOValue(gpio: number): Promise<GPIOValue> {
  const { stdout } = await exec(
    `gpioget --numeric --chip ${env.GPIO_CHIP} ${gpio}`,
  );
  const value = parseInt(stdout.trim(), 10);
  if (value !== GPIOValue.INACTIVE && value !== GPIOValue.ACTIVE) {
    throw new Error(`[GPIO] Invalid value: ${stdout}`);
  }
  return value;
}

export async function setGPIOValue(
  gpio: number,
  value: GPIOValue,
  options: Record<string, string>,
): Promise<void> {
  const optionString = Object.entries(options)
    .map(([key, value]) => `--${key} ${value}`)
    .join(" ");
  await exec(
    `gpioset --chip ${env.GPIO_CHIP} ${optionString} ${gpio}=${value}`,
  );
}
