import env from "@/env";
import pino from "pino";

export const loggerOptions = {
  level: env.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
    },
  },
};
const logger = pino(loggerOptions);

export default logger;
