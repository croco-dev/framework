import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from './types';

interface ContextData {
  context: RequestContext;
  createdAt: number;
  scopedCache: Map<string, unknown>;
}

const contextStorage = new AsyncLocalStorage<ContextData>();

export class Context {
  private static readonly STORAGE = contextStorage;

  static run<T>(context: RequestContext, fn: () => Promise<T> | T): Promise<T> | T {
    const data: ContextData = {
      context,
      createdAt: Date.now(),
      scopedCache: new Map(),
    };
    return Context.STORAGE.run(data, fn);
  }

  static get(): RequestContext | null {
    const data = Context.STORAGE.getStore();
    return data?.context ?? null;
  }

  static getRequestId(): string | null {
    const context = Context.get();
    return context?.requestId ?? null;
  }

  static isActive(): boolean {
    return Context.STORAGE.getStore() !== undefined;
  }

  static getCreatedAt(): number | null {
    const data = Context.STORAGE.getStore();
    return data?.createdAt ?? null;
  }

  static getCache(): Map<string, unknown> | undefined {
    return Context.STORAGE.getStore()?.scopedCache;
  }
}
