import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProjectIntentMap } from "../intent-map";

function readIntent(source: string) {
  const root = mkdtempSync(join(tmpdir(), "croco-component-bindings-"));
  try {
    writeFileSync(join(root, "providers.ts"), source);
    return createProjectIntentMap({ projectRoot: root, sourcePaths: ["providers.ts"] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("intent map Component bindings", () => {
  it.each([
    ["named import", 'import { Component } from "@croco/framework-context";', "Component"],
    ["named alias", 'import { Component as Service } from "@croco/framework-context";', "Service"],
    [
      "namespace import",
      'import * as Context from "@croco/framework-context";',
      "Context.Component",
    ],
  ])("preserves identity, scope and dependency edges for a %s", (_label, binding, decorator) => {
    const result = readIntent(`${binding}
@${decorator}({ scope: 'request' })
export class Repository {}
@${decorator}({ scope: 'transient' })
export class PersonService {
  constructor(private readonly repository: Repository) {}
}
@${decorator}()
export class DefaultService {}`);
    expect(result.providers).toEqual([
      expect.objectContaining({ id: "DefaultService", name: "DefaultService", scope: "singleton" }),
      expect.objectContaining({
        id: "PersonService",
        name: "PersonService",
        scope: "transient",
        dependencies: ["Repository"],
        source: { path: "providers.ts", line: 5, column: 8 },
      }),
      expect.objectContaining({ id: "Repository", name: "Repository", scope: "request" }),
    ]);
    expect(result.files[0]?.roles).toEqual(["di.provider"]);
    expect(result.relationships).toContainEqual(
      expect.objectContaining({
        kind: "component.depends-on",
        from: { kind: "provider", id: "PersonService" },
        to: { kind: "provider", id: "Repository" },
      }),
    );
  });

  it.each([
    "function Service() { return () => {}; }\n@Service()",
    "function Component() { return () => {}; }\n@Component()",
    'import { Component as Service } from "other-library";\n@Service()',
    'import { Component } from "other-library";\n@Component()',
    'import * as Context from "other-library";\n@Context.Component()',
    'import type { Component } from "@croco/framework-context";\n@Component()',
    'import { type Component } from "@croco/framework-context";\n@Component()',
    '// import { Component } from "@croco/framework-context";\nfunction Component() { return () => {}; }\n@Component()',
  ])("does not treat an unrelated or type-only binding as a provider: %s", (declaration) => {
    const result = readIntent(`${declaration}\nexport class Unrelated {}`);
    expect(result.providers).toEqual([]);
    expect(result.files[0]?.roles).toEqual([]);
  });

  it("reads scope only from the bound Component decorator", () => {
    const result = readIntent(`import { Component as Service } from '@croco/framework-context';
function Other(options: unknown) { return () => {}; }
@Other({ scope: 'request' })
@Service()
export class DefaultService {}
@Service({ scope: 'transient' })
@Other({ scope: 'request' })
export class TransientService {}`);
    expect(result.providers.map(({ name, scope }) => ({ name, scope }))).toEqual([
      { name: "DefaultService", scope: "singleton" },
      { name: "TransientService", scope: "transient" },
    ]);
  });
});
