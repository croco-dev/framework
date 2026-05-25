import { Container } from "typedi";
import { type ILogger, LOGGER_TOKEN } from "./ILogger";
import { ShutdownTimeoutProblem } from "./problems/ShutdownProblems";
import type { ShutdownHook } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

export class ShutdownManager {
  private static instance: ShutdownManager | undefined;
  private hooks: ShutdownHook[] = [];
  private isShuttingDown = false;
  private timeoutMs: number;
  private listenersRegistered = false;

  private constructor(timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  static getInstance(timeoutMs?: number): ShutdownManager {
    if (!ShutdownManager.instance) {
      ShutdownManager.instance = new ShutdownManager(timeoutMs);
    } else if (timeoutMs !== undefined) {
      ShutdownManager.instance.configure(timeoutMs);
    }
    return ShutdownManager.instance;
  }

  configure(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
    this.removeAllListeners();
  }

  static reset(): void {
    const manager = ShutdownManager.instance;
    if (manager) {
      manager.removeAllListeners();
      manager.hooks = [];
      manager.isShuttingDown = false;
    }
    ShutdownManager.instance = undefined;
  }

  register(hook: ShutdownHook): void {
    if (this.isShuttingDown) {
      return;
    }
    this.hooks.push(hook);
  }

  listen(): void {
    if (this.listenersRegistered) {
      return;
    }
    this.listenersRegistered = true;
    process.on("SIGTERM", this.handleSignal);
    process.on("SIGINT", this.handleSignal);
  }

  private handleSignal = async (): Promise<void> => {
    await this.shutdown();
  };

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    const reversedHooks = [...this.hooks].reverse();
    const controller = new AbortController();
    const hookExecution = (async (): Promise<void> => {
      for (const hook of reversedHooks) {
        try {
          await hook.onShutdown(controller.signal);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          if (Container.has(LOGGER_TOKEN)) {
            const logger = Container.get(LOGGER_TOKEN) as ILogger;
            logger.error("[ShutdownManager] Hook execution failed:", normalizedError);
          } else {
            // eslint-disable-next-line no-console
            console.error("[ShutdownManager] Hook execution failed:", normalizedError);
          }
        }
      }
    })();

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        if (Container.has(LOGGER_TOKEN)) {
          const logger = Container.get(LOGGER_TOKEN) as ILogger;
          logger.error("[ShutdownManager] Shutdown timeout exceeded.");
        } else {
          // eslint-disable-next-line no-console
          console.error("[ShutdownManager] Shutdown timeout exceeded.");
        }
        reject(new ShutdownTimeoutProblem(this.timeoutMs));
      }, this.timeoutMs);
    });

    try {
      await Promise.race([hookExecution, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      this.removeAllListeners();
    }
  }

  private removeAllListeners(): void {
    if (this.listenersRegistered) {
      process.off("SIGTERM", this.handleSignal);
      process.off("SIGINT", this.handleSignal);
      this.listenersRegistered = false;
    }
  }
}
