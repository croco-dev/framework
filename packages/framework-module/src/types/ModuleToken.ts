import type { Token } from "@croco/framework-context";

export type Constructor<T = unknown> = new (...args: never[]) => T;

export type ModuleToken<T> = Constructor<T> | Token<T> | string | symbol;
