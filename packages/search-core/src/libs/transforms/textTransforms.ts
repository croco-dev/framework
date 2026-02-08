import type { SearchTransformRef } from './types';

export type InitialsOptions = {
  locale?: string;
};

export type DecomposedOptions = {
  locale?: string;
  form?: 'nfd' | 'nfkd' | 'jamo';
};

export type RomanizedOptions = {
  locale?: string;
  system?: string;
};

export const textTransforms = {
  initials: {
    id: 'text.initials',
    defaultSuffix: '_initials',
  } as SearchTransformRef<InitialsOptions>,

  decomposed: {
    id: 'text.decomposed',
    defaultSuffix: '_decomposed',
  } as SearchTransformRef<DecomposedOptions>,

  romanized: {
    id: 'text.romanized',
    defaultSuffix: '_romanized',
  } as SearchTransformRef<RomanizedOptions>,
};
