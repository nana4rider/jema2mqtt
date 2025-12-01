import env from "@/env";
import * as child_process from "child_process";
import { promisify } from "util";

export const GPIOValue = {
  ACTIVE: 1,
  INACTIVE: 0,
} as const;
type GPIOValue = (typeof GPIOValue)[keyof typeof GPIOValue];

const execFileAsync = promisify(child_process.execFile);

export async function getGPIOValue(gpio: number): Promise<GPIOValue> {
  const { stdout } = await execFileAsync("gpioget", [
    "--numeric",
    "--chip",
    env.GPIO_CHIP.toString(),
    gpio.toString(),
  ]);
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
  const optionsArray = Object.entries(options).flatMap(([key, value]) => [
    `--${key}`,
    value,
  ]);
  await execFileAsync("gpioset", [
    "--chip",
    env.GPIO_CHIP.toString(),
    ...optionsArray,
    `${gpio}=${value}`,
  ]);
}
