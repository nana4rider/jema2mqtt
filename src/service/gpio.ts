import env from "@/env";
import * as child_process from "child_process";
import { promisify } from "util";

type GPIOValue = 0 | 1;

const exec = promisify(child_process.exec);

export async function getValue(gpio: number): Promise<GPIOValue> {
  const { stdout } = await exec(
    `gpioget --numeric --chip ${env.GPIO_CHIP} ${gpio}`,
  );
  const value = parseInt(stdout.trim(), 10);
  if (value !== 0 && value !== 1) {
    throw new Error(`[GPIO] Invalid value: ${value}`);
  }
  return value;
}

export async function setValue(
  gpio: number,
  value: GPIOValue,
  options: Record<string, string>,
) {
  const optionString = Object.entries(options)
    .map(([key, value]) => `--${key} ${value}`)
    .join(" ");
  await exec(
    `gpioset --chip ${env.GPIO_CHIP} ${optionString} ${gpio}=${value}`,
  );
}
