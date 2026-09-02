export type ModuleContribution<T = unknown, TKind extends string = string> = {
  /** Stable identity within one contribution kind. Distinct modules may not reuse it. */
  readonly id: string;
  /** Typed aggregation surface owned by the consuming package. */
  readonly kind: TKind;
  /** Lower values run or render first. Equal values are ordered by id, then module name. */
  readonly order?: number;
  readonly value: T;
};

export type ResolvedModuleContribution<T = unknown, TKind extends string = string> = {
  readonly id: string;
  readonly kind: TKind;
  readonly moduleName: string;
  readonly order: number;
  readonly value: T;
};

export type ModuleGraphContribution = {
  readonly id: string;
  readonly kind: string;
  readonly order: number;
};
