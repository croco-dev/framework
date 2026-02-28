import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from '../libs/Container';
import { Component } from '../libs/decorators/Component';
import { OnShutdown } from '../libs/decorators/OnShutdown';
import { ShutdownTimeoutProblem } from '../libs/problems/ShutdownProblems';
import { ShutdownManager } from '../libs/ShutdownManager';
import type { ShutdownHook } from '../libs/types';

describe('ShutdownManager', () => {
  beforeEach(() => {
    Container.reset();
    ShutdownManager.reset();
    Container.reset();
  });

  afterEach(() => {
    ShutdownManager.reset();
    Container.reset();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ShutdownManager.getInstance();
      const instance2 = ShutdownManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = ShutdownManager.getInstance();
      ShutdownManager.reset();
      const instance2 = ShutdownManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('register', () => {
    it('should register shutdown hook', () => {
      const manager = ShutdownManager.getInstance();
      const hook: ShutdownHook = {
        onShutdown: vi.fn(),
      };

      manager.register(hook);

      expect((manager as unknown as { hooks: ShutdownHook[] }).hooks).toContain(hook);
    });

    it('should not register hook during shutdown', async () => {
      const manager = ShutdownManager.getInstance();
      const hook1: ShutdownHook = {
        onShutdown: vi.fn().mockImplementation(async () => {
          const hook2: ShutdownHook = { onShutdown: vi.fn() };
          manager.register(hook2);
        }),
      };

      manager.register(hook1);
      await manager.shutdown();

      const hooks = (manager as unknown as { hooks: ShutdownHook[] }).hooks;
      expect(hooks).toHaveLength(1);
    });
  });

  describe('listen', () => {
    it('should register signal listeners', () => {
      const manager = ShutdownManager.getInstance();
      const processOnSpy = vi.spyOn(process, 'on');

      manager.listen();

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      processOnSpy.mockRestore();
    });

    it('should not register listeners twice', () => {
      const manager = ShutdownManager.getInstance();
      const processOnSpy = vi.spyOn(process, 'on');

      manager.listen();
      manager.listen();

      expect(processOnSpy).toHaveBeenCalledTimes(2);

      processOnSpy.mockRestore();
    });
  });

  describe('shutdown', () => {
    it('should execute hooks in reverse order (LIFO)', async () => {
      const manager = ShutdownManager.getInstance();
      const order: string[] = [];

      const hook1: ShutdownHook = {
        onShutdown: async () => {
          order.push('hook1');
        },
      };
      const hook2: ShutdownHook = {
        onShutdown: async () => {
          order.push('hook2');
        },
      };

      manager.register(hook1);
      manager.register(hook2);

      await manager.shutdown();

      expect(order).toEqual(['hook2', 'hook1']);
    });

    it('should continue executing hooks even if one fails', async () => {
      const manager = ShutdownManager.getInstance();
      const order: string[] = [];
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const hook1: ShutdownHook = {
        onShutdown: async () => {
          order.push('hook1');
        },
      };
      const hook2: ShutdownHook = {
        onShutdown: async () => {
          throw new Error('Hook failed');
        },
      };
      const hook3: ShutdownHook = {
        onShutdown: async () => {
          order.push('hook3');
        },
      };

      manager.register(hook1);
      manager.register(hook2);
      manager.register(hook3);

      await manager.shutdown();

      expect(order).toEqual(['hook3', 'hook1']);
      expect(errorSpy).toHaveBeenCalledWith('[ShutdownManager] Hook execution failed:', expect.any(Error));

      errorSpy.mockRestore();
    });

    it('should not execute shutdown twice', async () => {
      const manager = ShutdownManager.getInstance();
      const hook: ShutdownHook = {
        onShutdown: vi.fn(),
      };

      manager.register(hook);
      await manager.shutdown();
      await manager.shutdown();

      expect(hook.onShutdown).toHaveBeenCalledTimes(1);
    });

    it('should reject with timeout problem after timeout', async () => {
      vi.useFakeTimers();

      const manager = ShutdownManager.getInstance(100);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const hook: ShutdownHook = {
        onShutdown: async () => {
          await new Promise(() => {});
        },
      };

      manager.register(hook);

      const shutdownPromise = manager.shutdown();
      const rejected = expect(shutdownPromise).rejects.toBeInstanceOf(ShutdownTimeoutProblem);

      await vi.advanceTimersByTimeAsync(100);

      await rejected;
      expect(errorSpy).toHaveBeenCalledWith('[ShutdownManager] Shutdown timeout exceeded.');
      expect(exitSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});

describe('OnShutdown decorator', () => {
  beforeEach(() => {
    Container.reset();
    ShutdownManager.reset();
    Container.reset();
  });

  afterEach(() => {
    ShutdownManager.reset();
    Container.reset();
  });

  describe('as class decorator', () => {
    it('should register class implementing ShutdownHook', async () => {
      @OnShutdown()
      class MyService implements ShutdownHook {
        shutdownCalled = false;

        async onShutdown(): Promise<void> {
          this.shutdownCalled = true;
        }
      }

      Container.set(MyService, new MyService());

      const manager = ShutdownManager.getInstance();
      await manager.shutdown();

      const instance = Container.get(MyService);
      expect(instance.shutdownCalled).toBe(true);
    });
  });

  describe('as method decorator', () => {
    it('should register method as shutdown hook', async () => {
      const manager = ShutdownManager.getInstance();
      const hooksBefore = (manager as unknown as { hooks: ShutdownHook[] }).hooks.length;

      class MyService {
        @OnShutdown()
        async cleanup(): Promise<void> {}
      }

      void MyService;

      const hooksAfter = (manager as unknown as { hooks: ShutdownHook[] }).hooks.length;
      expect(hooksAfter).toBe(hooksBefore + 1);
    });
  });
});
