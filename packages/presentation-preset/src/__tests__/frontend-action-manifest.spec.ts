import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkFrontendActionManifestFile,
  createFrontendActionManifest,
  FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION,
  mergeFrontendActionManifests,
  serializeFrontendActionManifest,
  writeFrontendActionManifest,
  writeMergedFrontendActionManifest,
  type FrontendActionManifestEntry,
} from "../frontend-action-manifest";

const action: FrontendActionManifestEntry = {
  id: "rest:UsersController.createUser",
  source: {
    kind: "rest-rpc-route",
    packageName: "@croco/rpc-codegen",
    routeId: "UsersController.createUser",
    operationId: "UsersController_createUser",
    controllerName: "UsersController",
    methodName: "createUser",
    domain: "user",
  },
  method: "POST",
  path: "/users",
  input: {
    kind: "generated-type",
    ref: "CreateUserInput",
    locations: ["body"],
  },
  output: {
    kind: "generated-type",
    ref: "CreateUserOutput",
  },
  problems: [
    {
      code: "USER_EXISTS",
      category: "Conflict",
      status: 409,
      description: "The email address is already registered.",
    },
  ],
  permissions: {
    guards: [
      {
        id: "UsersController.createUser.guard.0",
        name: "session",
        owner: {
          controllerName: "UsersController",
          routeId: "UsersController.createUser",
          methodName: "createUser",
        },
      },
    ],
    roles: ["admin"],
    entitlements: [
      {
        feature: "users.write",
        resource: { type: "tenant", idParam: "tenantId" },
      },
    ],
  },
  invalidates: [
    {
      kind: "query-key-prefix",
      target: "user",
      reason: "mutation",
    },
  ],
};

const serverAction: FrontendActionManifestEntry = {
  id: "server-action:signup",
  source: {
    kind: "meta-vite-server-action",
    packageName: "@croco/meta-vite",
    actionName: "signup",
  },
  method: "POST",
  path: "/api/action/signup",
  input: { kind: "declared-schema", ref: "signup.input", locations: ["form-data"] },
  output: { kind: "declared-schema", ref: "signup.output" },
  problems: [],
  permissions: { guards: [], roles: [], entitlements: [] },
  invalidates: [{ kind: "query-key-prefix", target: "session" }],
};

describe("FrontendActionManifest", () => {
  it("merges producer manifests into byte-identical output regardless of input order", () => {
    const rpcManifest = createFrontendActionManifest([action]);
    const metaViteManifest = createFrontendActionManifest([serverAction]);
    const forward = mergeFrontendActionManifests([
      { source: "@croco/rpc-codegen", manifest: rpcManifest },
      { source: "@croco/meta-vite", manifest: metaViteManifest },
    ]);
    const reverse = mergeFrontendActionManifests([
      { source: "@croco/meta-vite", manifest: metaViteManifest },
      { source: "@croco/rpc-codegen", manifest: rpcManifest },
    ]);

    expect(forward.actions.map(({ id }) => id)).toEqual([
      "rest:UsersController.createUser",
      "server-action:signup",
    ]);
    expect(serializeFrontendActionManifest(forward)).toBe(serializeFrontendActionManifest(reverse));
  });

  it("deduplicates identical action definitions", () => {
    const manifest = createFrontendActionManifest([action]);

    expect(
      mergeFrontendActionManifests([
        { source: "first producer", manifest },
        { source: "second producer", manifest },
      ]).actions,
    ).toEqual([action]);
  });

  it("selects byte-identical duplicates deterministically when producer labels match", () => {
    const reorderedAction: FrontendActionManifestEntry = {
      invalidates: action.invalidates,
      permissions: action.permissions,
      problems: action.problems,
      output: action.output,
      input: action.input,
      path: action.path,
      method: action.method,
      source: action.source,
      id: action.id,
    };
    const first = { source: "shared producer", manifest: createFrontendActionManifest([action]) };
    const second = {
      source: "shared producer",
      manifest: createFrontendActionManifest([reorderedAction]),
    };

    const forward = mergeFrontendActionManifests([first, second]);
    const reverse = mergeFrontendActionManifests([second, first]);

    expect(serializeFrontendActionManifest(forward)).toBe(serializeFrontendActionManifest(reverse));
  });

  it("rejects conflicting duplicate action ids with both producer sources", () => {
    const conflicting = { ...action, path: "/accounts" };

    expect(() =>
      mergeFrontendActionManifests([
        { source: "REST generator", manifest: createFrontendActionManifest([action]) },
        {
          source: "server-action generator",
          manifest: createFrontendActionManifest([conflicting]),
        },
      ]),
    ).toThrow(
      expect.objectContaining({
        code: "presentation-preset/frontend-action-manifest-duplicate-conflict",
        detail: expect.stringContaining(
          'Action "rest:UsersController.createUser" has conflicting definitions from "REST generator" and "server-action generator".',
        ),
      }),
    );
  });

  it("rejects manifest schema mismatches before replacing the destination", async () => {
    const directory = await mkdtemp(join(tmpdir(), "croco-frontend-action-manifest-invalid-"));
    const outputPath = join(directory, "frontend-action-manifest.json");
    const existing = "existing manifest\n";

    try {
      await writeFile(outputPath, existing, "utf-8");

      await expect(
        writeMergedFrontendActionManifest(
          [
            {
              source: "legacy producer",
              manifest: { schemaVersion: "croco.frontend-action-manifest.v0", actions: [] },
            },
          ],
          outputPath,
        ),
      ).rejects.toMatchObject({
        code: "presentation-preset/frontend-action-manifest-invalid",
        detail: expect.stringContaining(
          'Manifest from "legacy producer" uses schema version "croco.frontend-action-manifest.v0"; expected "croco.frontend-action-manifest.v1".',
        ),
      });
      await expect(readFile(outputPath, "utf-8")).resolves.toBe(existing);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects nested manifest schema mismatches before replacing the destination", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "croco-frontend-action-manifest-nested-invalid-"),
    );
    const outputPath = join(directory, "frontend-action-manifest.json");
    const existing = "existing manifest\n";
    const malformedAction = {
      ...action,
      problems: [null],
      permissions: { guards: [], roles: [42], entitlements: [] },
      invalidates: [{ kind: "unknown", target: "users" }],
    };

    try {
      await writeFile(outputPath, existing, "utf-8");

      await expect(
        writeMergedFrontendActionManifest(
          [
            {
              source: "malformed producer",
              manifest: {
                schemaVersion: FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION,
                actions: [malformedAction],
              },
            },
          ],
          outputPath,
        ),
      ).rejects.toMatchObject({
        code: "presentation-preset/frontend-action-manifest-invalid",
        detail: expect.stringContaining(
          'Manifest from "malformed producer" contains an invalid action at index 0.',
        ),
      });
      await expect(readFile(outputPath, "utf-8")).resolves.toBe(existing);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects manifests whose JSON-normalized form violates the schema", () => {
    const inheritedAction = Object.create(action) as unknown;

    expect(() =>
      mergeFrontendActionManifests([
        {
          source: "inherited producer",
          manifest: {
            schemaVersion: FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION,
            actions: [inheritedAction],
          },
        },
      ]),
    ).toThrow(
      expect.objectContaining({
        code: "presentation-preset/frontend-action-manifest-invalid",
        detail: expect.stringContaining(
          'Manifest from "inherited producer" contains an invalid action at index 0.',
        ),
      }),
    );
  });

  it("reports non-serializable manifests as validation Problems", () => {
    const manifest = createFrontendActionManifest([action]) as {
      readonly actions: readonly FrontendActionManifestEntry[];
      readonly schemaVersion: typeof FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION;
      circular?: unknown;
    };
    manifest.circular = manifest;

    expect(() => mergeFrontendActionManifests([{ source: "circular producer", manifest }])).toThrow(
      expect.objectContaining({
        code: "presentation-preset/frontend-action-manifest-invalid",
        detail: 'Manifest from "circular producer" must be serializable as JSON.',
      }),
    );
  });

  it("writes a combined artifact that passes the drift assertion with every producer action", async () => {
    const directory = await mkdtemp(join(tmpdir(), "croco-frontend-action-manifest-combined-"));
    const outputPath = join(directory, "frontend-action-manifest.json");
    const inputs = [
      { source: "@croco/rpc-codegen", manifest: createFrontendActionManifest([action]) },
      { source: "@croco/meta-vite", manifest: createFrontendActionManifest([serverAction]) },
    ];
    const manifest = mergeFrontendActionManifests(inputs);

    try {
      await writeMergedFrontendActionManifest(inputs, outputPath);

      await expect(checkFrontendActionManifestFile(manifest, outputPath)).resolves.toEqual({
        ok: true,
        status: "current",
        path: outputPath,
      });
      expect(manifest.actions.map(({ id }) => id)).toEqual([
        "rest:UsersController.createUser",
        "server-action:signup",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes actions in deterministic order", () => {
    const manifest = createFrontendActionManifest([
      { ...action, id: "rest:UsersController.z" },
      action,
    ]);
    const serialized = serializeFrontendActionManifest(manifest);

    expect(serialized).toBe(serializeFrontendActionManifest(manifest));
    expect(serialized).toMatchInlineSnapshot(`
      "{
        "schemaVersion": "croco.frontend-action-manifest.v1",
        "actions": [
          {
            "id": "rest:UsersController.createUser",
            "source": {
              "kind": "rest-rpc-route",
              "packageName": "@croco/rpc-codegen",
              "routeId": "UsersController.createUser",
              "operationId": "UsersController_createUser",
              "controllerName": "UsersController",
              "methodName": "createUser",
              "domain": "user"
            },
            "method": "POST",
            "path": "/users",
            "input": {
              "kind": "generated-type",
              "ref": "CreateUserInput",
              "locations": [
                "body"
              ]
            },
            "output": {
              "kind": "generated-type",
              "ref": "CreateUserOutput"
            },
            "problems": [
              {
                "code": "USER_EXISTS",
                "category": "Conflict",
                "status": 409,
                "description": "The email address is already registered."
              }
            ],
            "permissions": {
              "guards": [
                {
                  "id": "UsersController.createUser.guard.0",
                  "name": "session",
                  "owner": {
                    "controllerName": "UsersController",
                    "routeId": "UsersController.createUser",
                    "methodName": "createUser"
                  }
                }
              ],
              "roles": [
                "admin"
              ],
              "entitlements": [
                {
                  "feature": "users.write",
                  "resource": {
                    "type": "tenant",
                    "idParam": "tenantId"
                  }
                }
              ]
            },
            "invalidates": [
              {
                "kind": "query-key-prefix",
                "target": "user",
                "reason": "mutation"
              }
            ]
          },
          {
            "id": "rest:UsersController.z",
            "source": {
              "kind": "rest-rpc-route",
              "packageName": "@croco/rpc-codegen",
              "routeId": "UsersController.createUser",
              "operationId": "UsersController_createUser",
              "controllerName": "UsersController",
              "methodName": "createUser",
              "domain": "user"
            },
            "method": "POST",
            "path": "/users",
            "input": {
              "kind": "generated-type",
              "ref": "CreateUserInput",
              "locations": [
                "body"
              ]
            },
            "output": {
              "kind": "generated-type",
              "ref": "CreateUserOutput"
            },
            "problems": [
              {
                "code": "USER_EXISTS",
                "category": "Conflict",
                "status": 409,
                "description": "The email address is already registered."
              }
            ],
            "permissions": {
              "guards": [
                {
                  "id": "UsersController.createUser.guard.0",
                  "name": "session",
                  "owner": {
                    "controllerName": "UsersController",
                    "routeId": "UsersController.createUser",
                    "methodName": "createUser"
                  }
                }
              ],
              "roles": [
                "admin"
              ],
              "entitlements": [
                {
                  "feature": "users.write",
                  "resource": {
                    "type": "tenant",
                    "idParam": "tenantId"
                  }
                }
              ]
            },
            "invalidates": [
              {
                "kind": "query-key-prefix",
                "target": "user",
                "reason": "mutation"
              }
            ]
          }
        ]
      }
      "
    `);
  });

  it("writes byte-stable manifest JSON and reports drift", async () => {
    const directory = await mkdtemp(join(tmpdir(), "croco-frontend-action-manifest-"));
    const outputPath = join(directory, "frontend-action-manifest.json");
    const manifest = createFrontendActionManifest([action]);

    try {
      await writeFrontendActionManifest(manifest, outputPath);

      await expect(readFile(outputPath, "utf-8")).resolves.toBe(
        serializeFrontendActionManifest(manifest),
      );
      await expect(checkFrontendActionManifestFile(manifest, outputPath)).resolves.toEqual({
        ok: true,
        status: "current",
        path: outputPath,
      });

      await writeFile(outputPath, "{}\n", "utf-8");

      await expect(checkFrontendActionManifestFile(manifest, outputPath)).resolves.toMatchObject({
        ok: false,
        status: "different",
        path: outputPath,
        actual: "{}\n",
        expected: serializeFrontendActionManifest(manifest),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
