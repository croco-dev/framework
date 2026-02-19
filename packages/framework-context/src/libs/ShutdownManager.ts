import type { ShutdownHook } from './types';

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
    }
    return ShutdownManager.instance;
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
    process.on('SIGTERM', this.handleSignal);
    process.on('SIGINT', this.handleSignal);
  }

  private handleSignal = async (): Promise<void> => {
    await this.shutdown();
  };

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    const timeout = setTimeout(() => {
      console.error('[ShutdownManager] Shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, this.timeoutMs);

    const reversedHooks = [...this.hooks].reverse();

    for (const hook of reversedHooks) {
      try {
        await hook.onShutdown();
      } catch (error) {
        console.error('[ShutdownManager] Hook execution failed:', error);
      }
    }

    clearTimeout(timeout);
  }

  private removeAllListeners(): void {
    if (this.listenersRegistered) {
      process.off('SIGTERM', this.handleSignal);
      process.off('SIGINT', this.handleSignal);
      this.listenersRegistered = false;
    }
  }
}
