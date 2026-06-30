import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkFrontendActionManifestFile,
  createFrontendActionManifest,
  serializeFrontendActionManifest,
  writeFrontendActionManifest,
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

describe("FrontendActionManifest", () => {
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
