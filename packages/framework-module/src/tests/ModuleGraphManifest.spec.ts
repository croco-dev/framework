import "reflect-metadata";
import { Container, Inject, Token } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { createModuleGraphManifest, defineCrocoModule } from "../index";
import { CrocoModule } from "../index";

describe("Module graph manifest", () => {
  beforeEach(() => {
    CrocoModule.reset();
    Container.reset();
  });

  it("fails provider visibility violations before module startup", () => {
    let setupRan = false;

    class PrivateDatabaseService {}

    class UserService {
      constructor(readonly database: PrivateDatabaseService) {}
    }

    Reflect.defineMetadata("design:paramtypes", [PrivateDatabaseService], UserService);

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [PrivateDatabaseService],
      setup: () => {
        setupRan = true;
      },
    });
    const usersModule = defineCrocoModule({
      name: "users",
      imports: [databaseModule],
      providers: [UserService],
    });

    const manifest = createModuleGraphManifest([usersModule]);

    expect(setupRan).toBe(false);
    expect(manifest).toMatchObject({
      version: "croco.module-graph.manifest.v1",
      status: "failed",
      modules: [
        {
          name: "database",
          providers: [{ token: "PrivateDatabaseService", provider: "class" }],
          exports: [],
        },
        {
          name: "users",
          imports: ["database"],
          providers: [{ token: "UserService", provider: "class" }],
        },
      ],
      diagnostics: [
        {
          code: "framework-module/provider-not-visible",
          severity: "error",
          moduleName: "users",
          token: "PrivateDatabaseService",
          path: ["users", "UserService", "PrivateDatabaseService"],
        },
      ],
    });
  });

  it("captures constructor token visibility violations", () => {
    const privateToken = new Token<string>("private-config");

    class UserService {
      constructor(@Inject(privateToken) readonly secret: unknown) {}
    }

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [{ provide: privateToken, useValue: "secret" }],
    });
    const usersModule = defineCrocoModule({
      name: "users",
      imports: [databaseModule],
      providers: [UserService],
    });

    const manifest = createModuleGraphManifest([usersModule]);

    expect(manifest.status).toBe("failed");
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "framework-module/provider-not-visible",
        moduleName: "users",
        token: "private-config",
        path: ["users", "UserService", "private-config"],
      }),
    );
  });
});
