import { createSearchTransformDefinition } from "./types";

export type InitialsOptions = {
  locale?: string;
};

export type DecomposedOptions = {
  locale?: string;
  form?: "nfd" | "nfkd" | "jamo";
};

export type RomanizedOptions = {
  locale?: string;
  system?: string;
};

export const textTransforms = {
  initials: createSearchTransformDefinition<InitialsOptions>("text.initials", "_initials"),
  decomposed: createSearchTransformDefinition<DecomposedOptions>("text.decomposed", "_decomposed"),
  romanized: createSearchTransformDefinition<RomanizedOptions>("text.romanized", "_romanized"),
};
