export function toPascalCase(input: string): string {
  if (!input) return "";
  const words = splitMixedCase(input);
  return words.map(capitalize).join("");
}

export function toCamelCase(input: string): string {
  if (!input) return "";
  const words = splitMixedCase(input);
  if (words.length === 0) return "";
  return words[0].toLowerCase() + words.slice(1).map(capitalize).join("");
}

export function toKebabCase(input: string): string {
  if (!input) return "";
  const words = splitMixedCase(input);
  return words.map((w) => w.toLowerCase()).join("-");
}

enum SplitState {
  NORMAL,
  UPPER,
}

export function splitMixedCase(input: string): string[] {
  if (!input) return [];
  const result: string[] = [];
  let current = "";
  let upperRun = "";
  let state = SplitState.NORMAL;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const isUpper = char >= "A" && char <= "Z";
    const isLower = char >= "a" && char <= "z";
    const isDigit = char >= "0" && char <= "9";
    const nextChar = i + 1 < input.length ? input[i + 1] : "";
    const nextIsLower = nextChar >= "a" && nextChar <= "z";
    const nextIsUpper = nextChar >= "A" && nextChar <= "Z";

    if (isUpper) {
      if (state === SplitState.NORMAL) {
        if (current) {
          result.push(current);
          current = "";
        }
        upperRun = char;
        state = SplitState.UPPER;
      } else {
        upperRun += char;
      }
    } else if (isLower) {
      if (state === SplitState.UPPER) {
        if (nextIsLower && upperRun.length > 1) {
          result.push(upperRun.slice(0, -1));
          current = upperRun[upperRun.length - 1] + char;
          upperRun = "";
          state = SplitState.NORMAL;
        } else if (nextIsLower) {
          current = upperRun + char;
          upperRun = "";
          state = SplitState.NORMAL;
        } else if (nextIsUpper) {
          upperRun += char;
        } else {
          result.push(upperRun);
          upperRun = "";
          current = char;
          state = SplitState.NORMAL;
        }
      } else {
        current += char;
      }
    } else if (isDigit) {
      if (upperRun) {
        result.push(upperRun);
        upperRun = "";
      }
      if (current) {
        result.push(current);
        current = "";
      }
      result.push(char);
      state = SplitState.NORMAL;
    } else {
      if (upperRun) {
        result.push(upperRun);
        upperRun = "";
      }
      if (current) {
        result.push(current);
        current = "";
      }
      state = SplitState.NORMAL;
    }
  }

  if (upperRun) {
    result.push(upperRun);
  }
  if (current) {
    result.push(current);
  }

  return result;
}

function capitalize(word: string): string {
  if (!word) return "";
  if (word.length > 1 && isAllUpperCase(word)) {
    return word;
  }
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function isAllUpperCase(word: string): boolean {
  for (const char of word) {
    if (char >= "A" && char <= "Z") continue;
    return false;
  }
  return true;
}

export function pluralize(input: string): string {
  if (!input) return "";
  const lower = input.toLowerCase();

  if (lower === "person") return "people";
  if (lower === "man") return "men";
  if (lower === "woman") return "women";
  if (lower === "child") return "children";
  if (lower === "tooth") return "teeth";
  if (lower === "foot") return "feet";
  if (lower === "mouse") return "mice";
  if (lower === "louse") return "lice";
  if (lower === "ox") return "oxen";
  if (lower === "axis") return "axes";
  if (lower === "crisis") return "crises";
  if (lower === "analysis") return "analyses";
  if (lower === "diagnosis") return "diagnoses";
  if (lower === "parenthesis") return "parentheses";
  if (lower === "synthesis") return "syntheses";
  if (lower === "thesis") return "theses";
  if (lower === "index") return "indices";

  if (lower === "status") return "statuses";

  if (lower.endsWith("y") && lower.length > 1) {
    const beforeY = lower[lower.length - 2];
    if (!isVowel(beforeY)) {
      return input.slice(0, -1) + "ies";
    }
  }

  if (lower.endsWith("us")) {
    const beforeUs = lower[lower.length - 2];
    if (!isVowel(beforeUs)) {
      return input.slice(0, -2) + "i";
    }
  }

  if (lower.endsWith("is")) {
    return input.slice(0, -2) + "es";
  }

  if (lower.endsWith("ex") || lower.endsWith("ix")) {
    return input.slice(0, -2) + "ices";
  }

  if (lower.endsWith("sh") || lower.endsWith("ch") || lower.endsWith("ss") || lower.endsWith("x")) {
    return input + "es";
  }

  if (lower.endsWith("fe")) {
    return input.slice(0, -2) + "ves";
  }

  if (lower.endsWith("f")) {
    return input.slice(0, -1) + "ves";
  }

  return input + "s";
}

function isVowel(char: string): boolean {
  return "aeiou".includes(char.toLowerCase());
}

export function validate(input: string): boolean {
  if (!input || input.length === 0) return false;
  if (/^[0-9]/.test(input)) return false;
  return /^[a-zA-Z0-9_-]+$/.test(input);
}

export function normalize(input: string, kind: "pascal" | "kebab" | "camel"): string {
  const words = splitMixedCase(input);
  if (words.length === 0) {
    throw new Error("Invalid input: cannot normalize empty result");
  }

  switch (kind) {
    case "pascal":
      return words.map(capitalize).join("");
    case "kebab":
      return words.map((w) => w.toLowerCase()).join("-");
    case "camel":
      return words[0].toLowerCase() + words.slice(1).map(capitalize).join("");
    default:
      throw new Error("Unknown kind: " + kind);
  }
}
