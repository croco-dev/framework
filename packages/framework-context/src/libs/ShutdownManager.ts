import { Container } from "./Container";
import { type ILogger, LOGGER_TOKEN } from "./ILogger";
import {
  ShutdownConfigurationConflictProblem,
  ShutdownHookExecutionProblem,
  ShutdownTimeoutProblem,
} from "./problems/ShutdownProblems";
import type { ShutdownHook } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

export type ShutdownOptions = {
  readonly throwOnHookError?: boolean;
};

export class ShutdownManager {
  private static instance: ShutdownManager | undefined;
  private static readonly scopedInstances = new Map<string, ShutdownManager>();
  private hooks: ShutdownHook[] = [];
  private isShuttingDown = false;
  private timeoutMs: number;
  private timeoutConfigured: boolean;
  private listenersRegistered = false;
  private signalShutdownPromise: Promise<void> | undefined;

  private constructor(timeoutMs?: number) {
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.timeoutConfigured = timeoutMs !== undefined;
  }

  static getInstance(timeoutMs?: number): ShutdownManager {
    const scopeId = Container.getActiveScopeId();
    if (scopeId) {
      const existing = ShutdownManager.scopedInstances.get(scopeId);
      if (existing) {
        if (timeoutMs !== undefined) {
          existing.configure(timeoutMs);
        }
        return existing;
      }

      const root = ShutdownManager.instance;
      const manager = new ShutdownManager(timeoutMs ?? root?.timeoutMs);
      manager.timeoutConfigured = timeoutMs !== undefined || (root?.timeoutConfigured ?? false);
      manager.hooks = root ? [...root.hooks] : [];
      ShutdownManager.scopedInstances.set(scopeId, manager);
      return manager;
    }

    if (!ShutdownManager.instance) {
      ShutdownManager.instance = new ShutdownManager(timeoutMs);
    } else if (timeoutMs !== undefined) {
      ShutdownManager.instance.configure(timeoutMs);
    }
    return ShutdownManager.instance;
  }

  configure(timeoutMs: number): void {
    if (this.timeoutConfigured && this.timeoutMs !== timeoutMs) {
      throw new ShutdownConfigurationConflictProblem(this.timeoutMs, timeoutMs);
    }
    this.timeoutMs = timeoutMs;
    this.timeoutConfigured = true;
  }

  static reset(): void {
    const scopeId = Container.getActiveScopeId();
    if (scopeId) {
      const manager = ShutdownManager.scopedInstances.get(scopeId);
      manager?.removeAllListeners();
      ShutdownManager.scopedInstances.delete(scopeId);
      return;
    }

    const manager = ShutdownManager.instance;
    if (manager) {
      manager.removeAllListeners();
      manager.hooks = [];
      manager.isShuttingDown = false;
      manager.signalShutdownPromise = undefined;
    }
    for (const scopedManager of ShutdownManager.scopedInstances.values()) {
      scopedManager.removeAllListeners();
    }
    ShutdownManager.scopedInstances.clear();
    ShutdownManager.instance = undefined;
  }

  static disposeCurrentScope(): void {
    const scopeId = Container.getActiveScopeId();
    if (!scopeId) {
      return;
    }

    ShutdownManager.scopedInstances.get(scopeId)?.removeAllListeners();
    ShutdownManager.scopedInstances.delete(scopeId);
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

  private handleSignal = (): void => {
    if (this.signalShutdownPromise) {
      return;
    }

    this.signalShutdownPromise = this.shutdown({ throwOnHookError: true });
    void this.signalShutdownPromise.catch((error: unknown) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      this.logError(
        "[ShutdownManager] Signal shutdown failed:",
        normalizedError,
        "[ShutdownManager] Signal shutdown failure logging failed:",
      );
      process.exitCode = 1;
    });
  };

  async shutdown(options: ShutdownOptions = {}): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    const reversedHooks = [...this.hooks].reverse();
    const controller = new AbortController();
    const failures: Error[] = [];
    const hookExecution = (async (): Promise<void> => {
      for (const hook of reversedHooks) {
        try {
          await hook.onShutdown(controller.signal);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          failures.push(normalizedError);
          if (options.throwOnHookError) {
            continue;
          }
          this.logError(
            "[ShutdownManager] Hook execution failed:",
            normalizedError,
            "[ShutdownManager] Hook failure logging failed:",
          );
        }
      }
    })();

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutProblem = new ShutdownTimeoutProblem(
          this.timeoutMs,
          options.throwOnHookError ? failures : [],
        );
        controller.abort();
        reject(timeoutProblem);
        this.logError(
          "[ShutdownManager] Shutdown timeout exceeded.",
          undefined,
          "[ShutdownManager] Shutdown timeout logging failed:",
        );
      }, this.timeoutMs);
    });

    try {
      await Promise.race([hookExecution, timeoutPromise]);
      if (options.throwOnHookError && failures.length > 0) {
        throw new ShutdownHookExecutionProblem(failures);
      }
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      this.removeAllListeners();
    }
  }

  private logError(message: string, error?: Error, loggingFailureMessage?: string): void {
    let loggingResult: unknown;
    try {
      if (Container.has(LOGGER_TOKEN)) {
        const logger = Container.get(LOGGER_TOKEN) as ILogger;
        if (error) {
          loggingResult = logger.error(message, error);
        } else {
          loggingResult = logger.error(message);
        }
      } else {
        // LOGGER_TOKEN is not registered in the DI container yet during early bootstrap.
        // eslint-disable-next-line no-console
        loggingResult = error ? console.error(message, error) : console.error(message);
      }
    } catch (loggingError) {
      this.logFallbackError(error, loggingError, loggingFailureMessage);
      return;
    }

    void Promise.resolve(loggingResult).catch((loggingError: unknown) => {
      this.logFallbackError(error, loggingError, loggingFailureMessage);
    });
  }

  private logFallbackError(
    error: Error | undefined,
    loggingError: unknown,
    message?: string,
  ): void {
    try {
      // A failing diagnostic sink must not replace or block the lifecycle result.
      // eslint-disable-next-line no-console
      const fallbackResult: unknown = console.error(
        message ?? "[ShutdownManager] Error logging failed:",
        { error, loggingError },
      );
      void Promise.resolve(fallbackResult).catch(() => undefined);
    } catch {
      // No diagnostic channel remains; the lifecycle result is still preserved.
      return;
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
