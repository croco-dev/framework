import type { ContainerInstance } from "typedi";
import { Container as FrameworkContainer } from "@croco/framework-context";
import { ModuleProviderVisibilityProblem } from "./problems";
import type { ResolvedModuleContribution } from "./types/ModuleContribution";
import type { Constructor } from "./types/ModuleToken";
import type { ModuleToken } from "./types/ModuleToken";

export type ModuleContextOptions = {
  readonly moduleName?: string;
  readonly rejectUnknownProvider?: boolean;
  readonly validateRuntime?: () => void;
  readonly resolveProvider?: <T>(token: ModuleToken<T>) => T;
  readonly canAccessToken?: (moduleName: string, token: ModuleToken<unknown>) => boolean;
  readonly isKnownToken?: (token: ModuleToken<unknown>) => boolean;
  readonly validateProviderWrite?: (
    moduleName: string | undefined,
    token: ModuleToken<unknown>,
  ) => void;
  readonly validateClassProvider?: (
    moduleName: string,
    providerClass: Constructor<unknown>,
  ) => void;
  readonly validateProviderAccess?: (moduleName: string, token: ModuleToken<unknown>) => void;
  readonly getContributions?: <T, TKind extends string>(
    kind: TKind,
  ) => readonly ResolvedModuleContribution<T, TKind>[];
};

export class ModuleContext {
  private readonly container: ContainerInstance;
  private readonly moduleName?: string;
  private readonly rejectUnknownProvider: boolean;
  private readonly validateRuntime?: () => void;
  private readonly resolveProvider?: <T>(token: ModuleToken<T>) => T;
  private readonly canAccessToken?: (moduleName: string, token: ModuleToken<unknown>) => boolean;
  private readonly isKnownToken?: (token: ModuleToken<unknown>) => boolean;
  private readonly validateProviderWrite?: (
    moduleName: string | undefined,
    token: ModuleToken<unknown>,
  ) => void;
  private readonly validateClassProvider?: (
    moduleName: string,
    providerClass: Constructor<unknown>,
  ) => void;
  private readonly validateProviderAccess?: (
    moduleName: string,
    token: ModuleToken<unknown>,
  ) => void;
  private readonly resolveContributions?: <T, TKind extends string>(
    kind: TKind,
  ) => readonly ResolvedModuleContribution<T, TKind>[];

  constructor(container: ContainerInstance, options: ModuleContextOptions = {}) {
    this.container = container;
    this.moduleName = options.moduleName;
    this.rejectUnknownProvider = options.rejectUnknownProvider ?? false;
    this.validateRuntime = options.validateRuntime;
    this.resolveProvider = options.resolveProvider;
    this.canAccessToken = options.canAccessToken;
    this.isKnownToken = options.isKnownToken;
    this.validateProviderWrite = options.validateProviderWrite;
    this.validateClassProvider = options.validateClassProvider;
    this.validateProviderAccess = options.validateProviderAccess;
    this.resolveContributions = options.getContributions;
  }

  get<T>(token: ModuleToken<T>): T {
    this.validateRuntime?.();
    this.assertTokenVisible(token);

    if (this.resolveProvider) {
      return this.resolveProvider(token);
    }

    return this.container.get(FrameworkContainer.toTypeDIServiceIdentifier(token));
  }

  set<T>(token: ModuleToken<T>, value: T): void {
    this.validateRuntime?.();
    this.validateProviderWrite?.(this.moduleName, token);
    this.container.set(FrameworkContainer.toTypeDIServiceIdentifier(token), value);
  }

  getContributions<T, TKind extends string = string>(
    kind: TKind,
  ): readonly ResolvedModuleContribution<T, TKind>[] {
    this.validateRuntime?.();
    return this.resolveContributions?.(kind) ?? [];
  }

  private assertTokenVisible<T>(token: ModuleToken<T>): void {
    if (!this.moduleName) {
      if (this.rejectUnknownProvider && !this.isKnownToken?.(token)) {
        throw new ModuleProviderVisibilityProblem("<root>", token);
      }
      return;
    }

    if (this.isKnownToken?.(token)) {
      if (this.canAccessToken?.(this.moduleName, token)) {
        this.validateProviderAccess?.(this.moduleName, token);
        return;
      }

      throw new ModuleProviderVisibilityProblem(this.moduleName, token);
    }

    if (this.rejectUnknownProvider) {
      throw new ModuleProviderVisibilityProblem(this.moduleName, token);
    }

    if (typeof token !== "function") {
      return;
    }

    const providerClass = token as unknown as Constructor<unknown>;
    this.validateClassProvider?.(this.moduleName, providerClass);
    throw new ModuleProviderVisibilityProblem(this.moduleName, providerClass);
  }
}
