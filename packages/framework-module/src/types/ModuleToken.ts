import type { Token } from "typedi";

export type Constructor<T = unknown> = new (...args: never[]) => T;

export type ModuleToken<T> = Constructor<T> | Token<T> | string;
