import type { Token } from 'typedi';
import type { ModuleContext } from './ModuleContext';

export type Constructor<T = unknown> = new (...args: unknown[]) => T;

export type ModuleOptions = {
  readonly name: string;
  readonly setup?: (ctx: ModuleContext) => void | Promise<void>;
  readonly start?: (ctx: ModuleContext) => void | Promise<void>;
  readonly imports?: readonly CrocoModule[];
};

export interface CrocoModule {
  readonly name: string;
  readonly setup?: (ctx: ModuleContext) => void | Promise<void>;
  readonly start?: (ctx: ModuleContext) => void | Promise<void>;
  readonly imports?: readonly CrocoModule[];
}

export type ModuleToken<T> = Constructor<T> | Token<T> | string;
