import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { BetterAuthFactory } from "../libs/BetterAuthFactory";
import { BetterAuthSessionManager } from "../libs/BetterAuthSessionManager";

describe("BetterAuthFactory integration", () => {
  it("should create an auth instance with executable session revocation APIs", () => {
    const database = {} as ConstructorParameters<typeof BetterAuthFactory>[0];
    const factory = new BetterAuthFactory(database, {
      baseURL: "http://localhost:3000",
      secret: "integration-secret-that-is-long-enough-for-better-auth",
    });

    const auth = factory.getAuth();
    const pluginIds = auth.options.plugins?.map((plugin) => plugin.id);

    expect(pluginIds).toEqual(["bearer", "admin"]);
    expect(auth.api.revokeSession).toBeTypeOf("function");
    expect(auth.api.revokeUserSessions).toBeTypeOf("function");
    expect(() => new BetterAuthSessionManager(factory)).not.toThrow();
  });
});
