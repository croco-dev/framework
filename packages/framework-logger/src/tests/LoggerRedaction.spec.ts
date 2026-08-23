import { Writable } from "node:stream";
import type { ConfigService } from "@croco/framework-config";
import { Context } from "@croco/framework-context";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { Logger } from "../Logger";
import { MAX_LOG_NESTING_DEPTH } from "../sanitizeLogRecord";

type LogRecord = Record<string, unknown>;

function createCapturedLogger(): { logger: Logger; records: () => LogRecord[] } {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString("utf8"));
      callback();
    },
  });
  const config = {
    get: () => "info",
    isProduction: true,
  } as unknown as ConfigService;
  const logger = new Logger(config);

  Object.defineProperty(logger["logger"], pino.symbols.streamSym, { value: destination });

  return {
    logger,
    records: () =>
      chunks
        .join("")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LogRecord),
  };
}

function serialized(records: LogRecord[]): string {
  return JSON.stringify(records);
}

describe("Logger serialized redaction", () => {
  it("removes sensitive keys case-insensitively from nested objects and arrays", () => {
    const { logger, records } = createCapturedLogger();

    Context.run({ requestId: "req-2057", traceId: "trace-2057" }, () => {
      logger.info("request received", {
        password: "root-password",
        request: {
          body: {
            PASSWORD: "nested-password",
            profile: { token: "nested-token", displayName: "Ada" },
          },
          headers: {
            Authorization: "nested-authorization",
            "x-request-id": "header-request-id",
          },
        },
        providers: [
          { SeCrEt: "array-secret", operation: "charge" },
          { Cookie: "array-cookie", status: 202 },
        ],
        callbackUrl: new URL("https://example.com/callback"),
      });
    });

    const output = records();
    const bytes = serialized(output);
    expect(bytes).not.toContain("root-password");
    expect(bytes).not.toContain("nested-password");
    expect(bytes).not.toContain("nested-token");
    expect(bytes).not.toContain("nested-authorization");
    expect(bytes).not.toContain("array-secret");
    expect(bytes).not.toContain("array-cookie");
    expect(output[0]).toMatchObject({
      requestId: "req-2057",
      traceId: "trace-2057",
      request: {
        body: { profile: { displayName: "Ada" } },
        headers: { "x-request-id": "header-request-id" },
      },
      providers: [{ operation: "charge" }, { status: 202 }],
      callbackUrl: "https://example.com/callback",
    });
  });

  it("redacts nested child bindings without removing correlation fields", () => {
    const { logger, records } = createCapturedLogger();
    const child = logger.child({
      requestId: "child-request-id",
      provider: { TOKEN: "child-token", accountId: "acct-2057" },
    });

    child.info("child event", { operation: "authorize" });

    const output = records();
    expect(serialized(output)).not.toContain("child-token");
    expect(output[0]).toMatchObject({
      requestId: "child-request-id",
      provider: { accountId: "acct-2057" },
      operation: "authorize",
    });
  });

  it("prevents Error metadata from reintroducing sensitive values", () => {
    const { logger, records } = createCapturedLogger();
    let getterCalls = 0;
    const error = Object.assign(new Error("provider failed"), {
      metadata: { secret: "error-secret", provider: "payments" },
      Authorization: "error-authorization",
    });
    Object.defineProperty(error, "cookie", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "error-cookie";
      },
    });

    logger.error("provider request failed", error);

    const output = records();
    const bytes = serialized(output);
    expect(bytes).not.toContain("error-secret");
    expect(bytes).not.toContain("error-authorization");
    expect(bytes).not.toContain("error-cookie");
    expect(getterCalls).toBe(0);
    expect(output[0]).toMatchObject({
      err: {
        type: "Error",
        message: "provider failed",
        stack: expect.stringContaining("Error: provider failed"),
        metadata: { provider: "payments" },
      },
    });
  });

  it("preserves cause and aggregate Error diagnostics", () => {
    const { logger, records } = createCapturedLogger();
    const nestedError = Object.assign(new Error("nested failure"), { token: "nested-token" });
    const error = Object.assign(new Error("aggregate failure"), { errors: [nestedError] });
    Object.defineProperty(error, "cause", { value: new Error("provider cause") });

    logger.error("aggregate request failed", error);

    const output = records();
    expect(serialized(output)).not.toContain("nested-token");
    expect(output[0]).toMatchObject({
      err: {
        message: "aggregate failure: provider cause",
        stack: expect.stringContaining("caused by: Error: provider cause"),
        aggregateErrors: [
          {
            message: "nested failure",
            stack: expect.stringContaining("Error: nested failure"),
          },
        ],
      },
    });
  });

  it("sanitizes circular and custom serialization values without an unredacted fallback", () => {
    const { logger, records } = createCapturedLogger();
    const circular: Record<string, unknown> = {
      operation: "circular-check",
      token: "circular-token",
    };
    circular.self = circular;
    const customSerialization = {
      operation: "custom-check",
      toJSON: () => ({ password: "custom-password" }),
    };
    const accessor = Object.defineProperty({ operation: "accessor-check" }, "secret", {
      enumerable: true,
      get() {
        throw new Error("accessor-secret");
      },
    });
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() =>
      logger.info("unsafe context", {
        circular,
        customSerialization,
        accessor,
        proxy: revocable.proxy,
        status: 202,
      }),
    ).not.toThrow();

    const output = records();
    const bytes = serialized(output);
    expect(bytes).not.toContain("circular-token");
    expect(bytes).not.toContain("custom-password");
    expect(bytes).not.toContain("accessor-secret");
    expect(output[0]).toMatchObject({
      circular: { operation: "circular-check", self: "[Circular]" },
      customSerialization: { operation: "custom-check" },
      accessor: { operation: "accessor-check" },
      proxy: "[Unserializable]",
      status: 202,
    });
  });

  it("does not execute top-level context getters before sanitization", () => {
    const { logger, records } = createCapturedLogger();
    let getterCalls = 0;
    const context = Object.defineProperty({ operation: "getter-check" }, "provider", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("top-level-getter-secret");
      },
    });

    expect(() =>
      Context.run({ requestId: "getter-request-id" }, () => logger.info("getter context", context)),
    ).not.toThrow();

    const output = records();
    expect(getterCalls).toBe(0);
    expect(serialized(output)).not.toContain("top-level-getter-secret");
    expect(output[0]).toMatchObject({ requestId: "getter-request-id", operation: "getter-check" });
  });

  it("keeps correlation context when an error context cannot be inspected", () => {
    const { logger, records } = createCapturedLogger();
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() =>
      Context.run({ requestId: "proxy-request-id" }, () =>
        logger.error("proxy context", revocable.proxy),
      ),
    ).not.toThrow();

    expect(records()[0]).toMatchObject({
      requestId: "proxy-request-id",
      context: "[Unserializable]",
    });
  });

  it("truncates branches beyond the supported nesting depth without leaking their values", () => {
    const { logger, records } = createCapturedLogger();
    const deepContext: Record<string, unknown> = {};
    let cursor = deepContext;

    for (let depth = 1; depth < MAX_LOG_NESTING_DEPTH; depth += 1) {
      const next: Record<string, unknown> = { depth };
      cursor.next = next;
      cursor = next;
    }
    cursor.next = { operation: "too-deep", password: "deep-password" };

    logger.info("deep context", { deepContext });

    const output = records();
    const bytes = serialized(output);
    expect(bytes).not.toContain("deep-password");
    expect(bytes).not.toContain("too-deep");
    expect(bytes).toContain("[Truncated]");
  });
});
