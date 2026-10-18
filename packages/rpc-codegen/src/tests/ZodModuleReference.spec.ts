import { describe, expect, it } from "vitest";
import { hasZodModuleReference } from "../libs/hasZodModuleReference";

describe("generated client Zod module references", () => {
  it.each([
    "import { z } from 'zod';",
    'import type { ZodType } from "zod";',
    "import 'zod';",
    "export { z } from 'zod';",
    "export * from 'zod/v4';",
    "const schema = import('zod');",
    "const schema = require('zod/v3');",
    "import schema = require('zod');",
    "type Schema = import('zod').ZodType;",
    "import { z } from 'z\\u006fd';",
  ])("detects a forbidden module reference: %s", (source) => {
    expect(hasZodModuleReference(source)).toBe(true);
  });

  it.each([
    "export type Response = { zodiacSign: string };",
    "const path = '/zodiac';",
    "const label = \"import { z } from 'zod'\";",
    "// import { z } from 'zod';",
    "/* export * from 'zod'; */",
    "import { z } from './rpc';",
    "import { zodiac } from 'zodiac';",
  ])("allows ordinary data and unrelated modules: %s", (source) => {
    expect(hasZodModuleReference(source)).toBe(false);
  });
});
