import type { DecomposedOptions, InitialsOptions } from "../libs/transforms/textTransforms";
import { SearchTransformAdapter } from "../libs/transforms/types";
import { extractChosung, extractJamo } from "./hangul";

export class KoreanChosungAdapter extends SearchTransformAdapter<InitialsOptions> {
  readonly id = "text.initials";
  readonly defaultSuffix = "_initials";

  transform(input: string, options: InitialsOptions): string {
    if (!options?.locale || options.locale === "ko") {
      return extractChosung(input);
    }

    return input.charAt(0);
  }
}

export class KoreanJamoAdapter extends SearchTransformAdapter<DecomposedOptions> {
  readonly id = "text.decomposed";
  readonly defaultSuffix = "_decomposed";

  transform(input: string, options: DecomposedOptions): string {
    if (!options?.locale || options.locale === "ko") {
      return extractJamo(input);
    }

    const form = options?.form === "nfkd" ? "NFKD" : "NFD";
    return input.normalize(form);
  }
}
