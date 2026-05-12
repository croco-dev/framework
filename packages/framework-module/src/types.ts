import type { ModuleContext } from "./ModuleContext";

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
