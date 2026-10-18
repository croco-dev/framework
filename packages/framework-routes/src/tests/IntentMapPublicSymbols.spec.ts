import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProjectIntentMap } from "../intent-map";

function inspect(source: string, fileName = "index.ts") {
  const root = mkdtempSync(join(tmpdir(), "croco-intent-public-symbols-"));
  try {
    writeFileSync(join(root, fileName), source);
    return createProjectIntentMap({ projectRoot: root, sourcePaths: [fileName] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("intent map public symbols", () => {
  it("excludes export text in lexical trivia and values from symbols and summary", () => {
    const result = inspect(
      [
        "// export class Ghost {}",
        "/* export interface Comment {} */",
        'export const text = "export class Fiction {}";',
        "const single = 'export function Fabricated() {}';",
        'const template = `export type Imaginary = string; ${"export enum Fake {}"}`;',
        "const pattern = /export class RegexGhost {}/;",
        'const named = "export { bogus as Alias }";',
        "export const actual = 1;",
      ].join("\n"),
    );

    expect(result.files[0]?.publicSymbols).toEqual([
      { name: "actual", kind: "const", location: { path: "index.ts", line: 8, column: 1 } },
      { name: "text", kind: "const", location: { path: "index.ts", line: 3, column: 1 } },
    ]);
    expect(result.summary.publicSymbols).toBe(2);
  });

  it("preserves real declarations and named exports with their export locations", () => {
    const result = inspect(
      [
        "// leading comment",
        "  export /* declaration */ abstract class Service {}",
        "export default function named() {}",
        "export async function load() {}",
        "export interface Shape {}",
        "export type Id = string;",
        "export enum Mode { Active }",
        "export const first = 1, second = 2;",
        "export let mutable = 3;",
        "export var legacy = 4;",
        "export declare const ambient: string;",
        "const local = 5;",
        "  export { local as exposed };",
        'export { Service as Remote, type Id as RemoteId } from "./other";',
        'export type { Shape as PublicShape } from "./types";',
      ].join("\n"),
    );
    const symbols = result.files[0]?.publicSymbols;
    expect(
      symbols?.map(({ name, kind, location }) => [name, kind, location.line, location.column]),
    ).toEqual([
      ["Id", "type", 6, 1],
      ["Mode", "enum", 7, 1],
      ["PublicShape", "re-export", 15, 1],
      ["Remote", "re-export", 14, 1],
      ["RemoteId", "re-export", 14, 1],
      ["Service", "class", 2, 3],
      ["Shape", "interface", 5, 1],
      ["ambient", "const", 11, 1],
      ["exposed", "re-export", 13, 3],
      ["first", "const", 8, 1],
      ["legacy", "var", 10, 1],
      ["load", "function", 4, 1],
      ["mutable", "let", 9, 1],
      ["named", "function", 3, 1],
      ["second", "const", 8, 1],
    ]);
    expect(result.summary.publicSymbols).toBe(15);
  });

  it("records module bindings without publishing nested declarations or JSX text", () => {
    const result = inspect(
      [
        "namespace Internal { export class Hidden {} }",
        "const view = <div>export class MarkupGhost {}</div>;",
        "export const { source: renamed, nested: { leaf }, ...rest } = value;",
        "export const [head, , ...tail] = items;",
      ].join("\r\n"),
      "index.tsx",
    );
    expect(
      result.files[0]?.publicSymbols.map(({ name, kind, location }) => [name, kind, location]),
    ).toEqual([
      ["head", "const", { path: "index.tsx", line: 4, column: 1 }],
      ["leaf", "const", { path: "index.tsx", line: 3, column: 1 }],
      ["renamed", "const", { path: "index.tsx", line: 3, column: 1 }],
      ["rest", "const", { path: "index.tsx", line: 3, column: 1 }],
      ["tail", "const", { path: "index.tsx", line: 4, column: 1 }],
    ]);
    expect(result.summary.publicSymbols).toBe(5);
  });
});
