import env from "@/env";
import * as child_process from "child_process";
import { promisify } from "util";

const exec = promisify(child_process.exec);

export async function getValue(gpio: number) {
  const { stdout } = await exec(
    `gpioget --numeric --chip ${env.GPIO_CHIP} ${gpio}`,
  );
  return Number(stdout);
}

export async function setValue(
  gpio: number,
  value: 0 | 1,
  options: Record<string, string>,
) {
  const optionString = Object.entries(options)
    .map(([key, value]) => `--${key} ${value}`)
    .join(" ");
  await exec(
    `gpioset --chip ${env.GPIO_CHIP} ${optionString} ${gpio}=${value}`,
  );
}
