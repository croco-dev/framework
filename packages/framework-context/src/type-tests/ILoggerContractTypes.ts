import { Container } from "../libs/Container";
import { LOGGER_TOKEN } from "../libs/ILogger";

export function logFatalThroughLoggerToken(error: Error): void {
  const logger = Container.get(LOGGER_TOKEN);
  logger.fatal("Cannot start", error);
  logger.child({ component: "bootstrap" }).fatal("Cannot start", error);
}
