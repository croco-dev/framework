import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../../framework-logger/src/Logger";
import { Container, LOGGER_TOKEN } from "../index";
import type { ILogger } from "../index";

describe("ILogger", () => {
  beforeEach(() => {
    Container.reset();
  });

  afterEach(() => {
    Container.reset();
  });

  it("should expose LOGGER_TOKEN with the ILogger name", () => {
    expect(LOGGER_TOKEN.name).toBe("ILogger");
  });

  it("should be compatible with Logger instances", () => {
    const acceptsLogger = <T extends ILogger>(_logger: T) => true;
    const isAssignable = acceptsLogger<Logger>;

    expect(isAssignable).toBeTypeOf("function");
  });

  it("LOGGER_TOKEN consumers can log fatal errors through child loggers", () => {
    const fatal = vi.fn();
    const logger: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal,
      child: vi.fn(function (this: ILogger) {
        return this;
      }),
    };
    const error = new Error("startup failed");

    Container.set(LOGGER_TOKEN, logger);
    Container.get(LOGGER_TOKEN).child({ component: "bootstrap" }).fatal("Cannot start", error);

    expect(fatal).toHaveBeenCalledWith("Cannot start", error);
  });
});
