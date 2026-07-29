import { describe, expect, it } from "vitest";
import { type KeyContext, RateLimitKeyBuilder } from "../libs/RateLimitKeyBuilder";

describe("RateLimitKeyBuilder", () => {
  const createContext = (data: Record<string, unknown>): KeyContext => ({
    get: <T>(key: string): T | undefined => data[key] as T | undefined,
  });

  describe("constructor", () => {
    it("should throw if no segments provided", () => {
      expect(() => new RateLimitKeyBuilder([])).toThrow("At least one key segment is required");
    });

    it("should accept valid segments", () => {
      const builder = new RateLimitKeyBuilder(["tenant", "user"]);
      expect(builder).not.toBeUndefined();
    });
  });

  describe("build", () => {
    it("should keep delimiter-bearing principals in distinct buckets", () => {
      const builder = new RateLimitKeyBuilder(["tenant", "user"]);
      const first = createContext({ tenantId: "a:b", userId: "c" });
      const second = createContext({ tenantId: "a", userId: "b:c" });

      expect(builder.build(first, "p")).not.toBe(builder.build(second, "p"));
    });

    it("should keep policy names distinct from segment values", () => {
      const builder = new RateLimitKeyBuilder(["tenant"]);

      expect(builder.build(createContext({ tenantId: "b" }), "p:a")).not.toBe(
        builder.build(createContext({ tenantId: "a:b" }), "p"),
      );
    });

    it("should use a namespace outside the legacy key grammar", () => {
      const builder = new RateLimitKeyBuilder(["tenant"]);
      const structuredPayload = '[["policy","p"],["tenant","x"]]';
      const legacyKey = `rl:v2:${structuredPayload}`;

      expect(builder.build(createContext({ tenantId: "x" }), "p")).toBe(`rl2:${structuredPayload}`);
      expect(builder.build(createContext({ tenantId: "x" }), "p")).not.toBe(legacyKey);
    });

    it("should encode segment names, delimiters, IPv6, Unicode, empty values, and missing values", () => {
      const builder = new RateLimitKeyBuilder(["tenant", "user", "ip", "route"]);
      const emptyValue = builder.build(
        createContext({
          tenantId: "",
          userId: "사용자:一",
          ip: "2001:db8::1",
          method: "GET",
          path: "/v1/items:a",
        }),
        "정책:무료",
      );
      const missingValue = builder.build(
        createContext({
          userId: "사용자:一",
          ip: "2001:db8::1",
          method: "GET",
          path: "/v1/items:a",
        }),
        "정책:무료",
      );

      expect(emptyValue).toBe(
        'rl2:[["policy","정책:무료"],["tenant",""],["user","사용자:一"],["ip","2001:db8::1"],["route",[["method","GET"],["path","/v1/items:a"]]]]',
      );
      expect(missingValue).toBe(
        'rl2:[["policy","정책:무료"],["tenant",null],["user","사용자:一"],["ip","2001:db8::1"],["route",[["method","GET"],["path","/v1/items:a"]]]]',
      );
      expect(emptyValue).not.toBe(missingValue);
    });

    it("should keep route method and path boundaries distinct", () => {
      const builder = new RateLimitKeyBuilder(["route"]);
      const first = createContext({ method: "X:Y", path: "/z" });
      const second = createContext({ method: "X", path: "Y:/z" });

      expect(builder.build(first, "p")).not.toBe(builder.build(second, "p"));
    });

    it("should preserve custom principal values, delimiters, empty values, and missing values", () => {
      const builder = new RateLimitKeyBuilder(["custom"]);
      const delimiterValue = builder.build(createContext({ custom: "principal:a:b" }), "p");
      const emptyValue = builder.build(createContext({ custom: "" }), "p");
      const missingValue = builder.build(createContext({}), "p");

      expect(delimiterValue).toBe('rl2:[["policy","p"],["custom","principal:a:b"]]');
      expect(emptyValue).toBe('rl2:[["policy","p"],["custom",""]]');
      expect(missingValue).toBe('rl2:[["policy","p"],["custom",null]]');
      expect(new Set([delimiterValue, emptyValue, missingValue]).size).toBe(3);
    });

    it("should keep identical values in differently named segments distinct", () => {
      const context = createContext({ tenantId: "principal", userId: "principal" });

      expect(new RateLimitKeyBuilder(["tenant"]).build(context, "p")).not.toBe(
        new RateLimitKeyBuilder(["user"]).build(context, "p"),
      );
    });

    it("should build key with tenant segment", () => {
      const builder = new RateLimitKeyBuilder(["tenant"]);
      const context = createContext({ tenant: { id: "tenant_123" } });

      const key = builder.build(context, "api-default");
      expect(key).toBe('rl2:[["policy","api-default"],["tenant","tenant_123"]]');
    });

    it("should build key with user segment", () => {
      const builder = new RateLimitKeyBuilder(["user"]);
      const context = createContext({ user: { id: "user_456" } });

      const key = builder.build(context, "api-default");
      expect(key).toBe('rl2:[["policy","api-default"],["user","user_456"]]');
    });

    it("should build key with ip segment", () => {
      const builder = new RateLimitKeyBuilder(["ip"]);
      const context = createContext({ ip: "192.168.1.1" });

      const key = builder.build(context, "api-default");
      expect(key).toBe('rl2:[["policy","api-default"],["ip","192.168.1.1"]]');
    });

    it("should build key with route segment", () => {
      const builder = new RateLimitKeyBuilder(["route"]);
      const context = createContext({ method: "GET", path: "/api/users" });

      const key = builder.build(context, "api-default");
      expect(key).toBe(
        'rl2:[["policy","api-default"],["route",[["method","GET"],["path","/api/users"]]]]',
      );
    });

    it("should build key with multiple segments", () => {
      const builder = new RateLimitKeyBuilder(["tenant", "user", "route"]);
      const context = createContext({
        tenant: { id: "tenant_123" },
        user: { id: "user_456" },
        method: "POST",
        path: "/api/orders",
      });

      const key = builder.build(context, "premium");
      expect(key).toBe(
        'rl2:[["policy","premium"],["tenant","tenant_123"],["user","user_456"],["route",[["method","POST"],["path","/api/orders"]]]]',
      );
    });

    it("should use null for missing segments", () => {
      const builder = new RateLimitKeyBuilder(["tenant", "user"]);
      const context = createContext({ tenant: { id: "tenant_123" } });

      const key = builder.build(context, "api-default");
      expect(key).toBe('rl2:[["policy","api-default"],["tenant","tenant_123"],["user",null]]');
    });

    it("should support tenantId shorthand", () => {
      const builder = new RateLimitKeyBuilder(["tenant"]);
      const context = createContext({ tenantId: "tenant_789" });

      const key = builder.build(context, "api-default");
      expect(key).toBe('rl2:[["policy","api-default"],["tenant","tenant_789"]]');
    });

    it("should support clientIp shorthand", () => {
      const builder = new RateLimitKeyBuilder(["ip"]);
      const context = createContext({ clientIp: "10.0.0.1" });

      const key = builder.build(context, "api-default");
      expect(key).toBe('rl2:[["policy","api-default"],["ip","10.0.0.1"]]');
    });
  });
});
