import env from "@/env";
import pino from "pino";

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    bindings: () => ({}),
  },
});

export default logger;
