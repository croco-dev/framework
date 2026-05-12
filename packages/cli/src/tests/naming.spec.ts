import { describe, it, expect } from "vitest";
import {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  splitMixedCase,
  pluralize,
  validate,
  normalize,
} from "../libs/naming.js";

describe("toPascalCase", () => {
  it("should convert snake_case to PascalCase", () => {
    expect(toPascalCase("user_profile")).toBe("UserProfile");
  });

  it("should preserve acronyms", () => {
    expect(toPascalCase("XMLParser")).toBe("XMLParser");
  });

  it("should handle camelCase input", () => {
    expect(toPascalCase("userProfile")).toBe("UserProfile");
  });
});

describe("toCamelCase", () => {
  it("should convert snake_case to camelCase", () => {
    expect(toCamelCase("user_profile")).toBe("userProfile");
  });

  it("should preserve acronyms", () => {
    expect(toCamelCase("XMLParser")).toBe("xmlParser");
  });

  it("should handle PascalCase input", () => {
    expect(toCamelCase("UserProfile")).toBe("userProfile");
  });
});

describe("toKebabCase", () => {
  it("should convert PascalCase to kebab-case", () => {
    expect(toKebabCase("UserProfile")).toBe("user-profile");
  });

  it("should convert camelCase to kebab-case", () => {
    expect(toKebabCase("userProfile")).toBe("user-profile");
  });

  it("should handle snake_case input", () => {
    expect(toKebabCase("user_profile")).toBe("user-profile");
  });
});

describe("splitMixedCase", () => {
  it("should split acronym followed by word", () => {
    expect(splitMixedCase("XMLParser")).toEqual(["XML", "Parser"]);
  });

  it("should split camelCase", () => {
    expect(splitMixedCase("userProfile")).toEqual(["user", "Profile"]);
  });

  it("should split words with digits", () => {
    expect(splitMixedCase("user123Profile")).toEqual(["user", "1", "2", "3", "Profile"]);
  });
});

describe("pluralize", () => {
  it("should pluralize regular nouns", () => {
    expect(pluralize("user")).toBe("users");
  });

  it("should pluralize entity -> entities", () => {
    expect(pluralize("entity")).toBe("entities");
  });

  it("should pluralize status -> statuses", () => {
    expect(pluralize("status")).toBe("statuses");
  });

  it("should pluralize index -> indices", () => {
    expect(pluralize("index")).toBe("indices");
  });

  it("should pluralize leaf -> leaves", () => {
    expect(pluralize("leaf")).toBe("leaves");
  });

  it("should pluralize knife -> knives", () => {
    expect(pluralize("knife")).toBe("knives");
  });

  it("should pluralize country -> countries", () => {
    expect(pluralize("country")).toBe("countries");
  });
});

describe("validate", () => {
  it("should return true for valid names", () => {
    expect(validate("user_name")).toBe(true);
  });

  it("should return true for names with hyphen", () => {
    expect(validate("user-name")).toBe(true);
  });

  it("should return false for names starting with digit", () => {
    expect(validate("123user")).toBe(false);
  });

  it("should return false for non-ASCII characters", () => {
    expect(validate("사용자")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(validate("")).toBe(false);
  });
});

describe("normalize", () => {
  it("should normalize to PascalCase", () => {
    expect(normalize("user profile", "pascal")).toBe("UserProfile");
  });

  it("should normalize to kebab-case", () => {
    expect(normalize("UserProfile", "kebab")).toBe("user-profile");
  });

  it("should normalize to camelCase", () => {
    expect(normalize("user profile", "camel")).toBe("userProfile");
  });
});
