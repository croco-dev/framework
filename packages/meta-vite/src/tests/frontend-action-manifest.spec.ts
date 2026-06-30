import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createServerAction, createServerActionRegistry } from "../libs/actions/serverActions";
import {
  checkMetaViteFrontendActionManifestFile,
  createMetaViteFrontendActionManifest,
  createMetaViteFrontendActionManifestFromRegistry,
  serializeMetaViteFrontendActionManifest,
  writeMetaViteFrontendActionManifest,
} from "../libs/build/frontendActionManifest";

describe("createMetaViteFrontendActionManifestFromRegistry", () => {
  it("emits a deterministic frontend action manifest for server actions", () => {
    const serverActionRegistry = createServerActionRegistry();
    createServerAction(
      {
        name: "signup",
        schema: z.object({ email: z.string().email() }),
        output: {
          description: "Signup result",
          schema: z.object({ ok: z.boolean() }),
        },
        problems: [
          {
            code: "auth/signup-closed",
            status: 422,
            description: "Signup is disabled",
            type: "https://example.com/problems/signup-closed",
          },
        ],
        invalidates: [
          {
            kind: "query-key-prefix",
            target: "session",
            reason: "signup accepted",
          },
        ],
        handler: async () => ({ ok: true, data: { ok: true } }),
      },
      serverActionRegistry,
    );

    const manifest = createMetaViteFrontendActionManifestFromRegistry({
      serverActionRegistry,
    });
    const serialized = serializeMetaViteFrontendActionManifest(manifest);

    expect(serialized).toBe(serializeMetaViteFrontendActionManifest(manifest));
    expect(serialized).toMatchInlineSnapshot(`
      "{
        "schemaVersion": "croco.frontend-action-manifest.v1",
        "actions": [
          {
            "id": "server-action:signup",
            "source": {
              "kind": "meta-vite-server-action",
              "packageName": "@croco/meta-vite",
              "actionName": "signup"
            },
            "method": "POST",
            "path": "/api/action/signup",
            "input": {
              "kind": "declared-schema",
              "ref": "signup.input",
              "locations": [
                "form-data"
              ]
            },
            "output": {
              "kind": "declared-schema",
              "ref": "signup.output",
              "description": "Signup result"
            },
            "problems": [
              {
                "code": "auth/signup-closed",
                "status": 422,
                "description": "Signup is disabled",
                "type": "https://example.com/problems/signup-closed"
              }
            ],
            "permissions": {
              "guards": [],
              "roles": [],
              "entitlements": []
            },
            "invalidates": [
              {
                "kind": "query-key-prefix",
                "target": "session",
                "reason": "signup accepted"
              }
            ]
          }
        ]
      }
      "
    `);
  });

  it("normalizes older server action contracts without invalidation metadata", () => {
    const manifest = createMetaViteFrontendActionManifest({
      serverActions: [
        {
          name: "refresh-session",
          path: "/api/action/refresh-session",
          method: "POST",
          input: { schema: "none" },
          output: { schema: "none" },
          problems: [],
        },
      ],
    });

    expect(manifest.actions[0]?.invalidates).toEqual([]);
    expect(serializeMetaViteFrontendActionManifest(manifest)).toContain('"invalidates": []');
  });

  it("writes byte-stable manifest JSON and reports drift", async () => {
    const serverActionRegistry = createServerActionRegistry();
    createServerAction(
      {
        name: "refresh-session",
        handler: async () => ({ ok: true, data: {} }),
      },
      serverActionRegistry,
    );
    const manifest = createMetaViteFrontendActionManifestFromRegistry({ serverActionRegistry });
    const directory = await mkdtemp(join(tmpdir(), "croco-meta-frontend-action-manifest-"));
    const outputPath = join(directory, "dist", "frontend-action-manifest.json");

    try {
      await writeMetaViteFrontendActionManifest(manifest, outputPath);

      await expect(readFile(outputPath, "utf-8")).resolves.toBe(
        serializeMetaViteFrontendActionManifest(manifest),
      );
      await expect(checkMetaViteFrontendActionManifestFile(manifest, outputPath)).resolves.toEqual({
        ok: true,
        status: "current",
        path: outputPath,
      });

      await writeFile(outputPath, "{}\n", "utf-8");

      await expect(
        checkMetaViteFrontendActionManifestFile(manifest, outputPath),
      ).resolves.toMatchObject({
        ok: false,
        status: "different",
        path: outputPath,
        actual: "{}\n",
        expected: serializeMetaViteFrontendActionManifest(manifest),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
