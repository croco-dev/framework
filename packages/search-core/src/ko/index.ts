import type { DeriveOptions } from "../libs/transforms/derive";
import { derive } from "../libs/transforms/derive";
import type { DecomposedOptions, InitialsOptions } from "../libs/transforms/textTransforms";
import { textTransforms } from "../libs/transforms/textTransforms";

export function chosung(opts: Omit<DeriveOptions<InitialsOptions>, "options"> = {}) {
  return derive(textTransforms.initials, { ...opts, options: { locale: "ko" } });
}

export function jamo(opts: Omit<DeriveOptions<DecomposedOptions>, "options"> = {}) {
  return derive(textTransforms.decomposed, { ...opts, options: { locale: "ko", form: "jamo" } });
}

export { KoreanChosungAdapter, KoreanJamoAdapter } from "./adapters";
export { decomposeHangul, extractChosung, extractJamo, isHangulSyllable } from "./hangul";
