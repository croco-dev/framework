import { AsyncLocalStorage } from 'async_hooks';
import { RequestContext } from './types';

interface ContextData {
  context: RequestContext;
  createdAt: number;
}

const contextStorage = new AsyncLocalStorage<ContextData>();

export class Context {
  private static readonly STORAGE = contextStorage;

  static run<T>(context: RequestContext, fn: () => Promise<T> | T): Promise<T> | T {
    const data: ContextData = {
      context,
      createdAt: Date.now(),
    };
    return this.STORAGE.run(data, fn);
  }

  static get(): RequestContext | null {
    const data = this.STORAGE.getStore();
    return data?.context ?? null;
  }

  static getRequestId(): string | null {
    const context = this.get();
    return context?.requestId ?? null;
  }

  static isActive(): boolean {
    return this.STORAGE.getStore() !== undefined;
  }

  static getCreatedAt(): number | null {
    const data = this.STORAGE.getStore();
    return data?.createdAt ?? null;
  }
}
