import type { SearchDerivedFieldConfig } from '../types';
import type { SearchTransformRef } from './types';

export type DeriveOptions<TOptions> = {
  as?: string;
  options?: TOptions;
  filterable?: boolean;
  sortable?: boolean;
};

export function derive<TOptions>(
  ref: SearchTransformRef<TOptions>,
  opts: DeriveOptions<TOptions> = {}
): SearchDerivedFieldConfig {
  return {
    transformId: ref.id,
    as: opts.as,
    options: opts.options as Record<string, unknown> | undefined,
    filterable: opts.filterable,
    sortable: opts.sortable,
  };
}
