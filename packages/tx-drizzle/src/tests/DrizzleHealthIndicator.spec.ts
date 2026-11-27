import { describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";
import { DrizzleHealthIndicator } from "../libs/DrizzleHealthIndicator";

describe("DrizzleHealthIndicator", () => {
  it("should return up when transaction query succeeds", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = {
      transaction: vi.fn(async (callback: (tx: { execute: typeof execute }) => Promise<void>) => {
        await callback({ execute });
      }),
    };

    const indicator = new DrizzleHealthIndicator(db as never, { name: "primary-db" });

    await expect(indicator.check()).resolves.toEqual({
      name: "primary-db",
      status: "up",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("should return down with error details when transaction fails", async () => {
    const db = {
      transaction: vi
        .fn()
        .mockRejectedValue(
          ProblemFactory.internalServerError("testing/drizzle-transaction-failed", "database down"),
        ),
    };

    const indicator = new DrizzleHealthIndicator(db as never);

    await expect(indicator.check()).resolves.toEqual({
      name: "database",
      status: "down",
      details: { error: "database down" },
    });
  });

  it("should redact connection credentials from failure details", async () => {
    const db = {
      transaction: vi
        .fn()
        .mockRejectedValue(
          ProblemFactory.internalServerError(
            "testing/drizzle-health-indicator-redaction",
            "failed postgres://croco_user:super-secret@db.example/app?password=query-secret&sslmode=require token=raw-token",
          ),
        ),
    };

    const indicator = new DrizzleHealthIndicator(db as never);
    const result = await indicator.check();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("query-secret");
    expect(serialized).not.toContain("raw-token");
    expect(result).toEqual({
      name: "database",
      status: "down",
      details: {
        error:
          "failed postgres://[redacted]@db.example/app?password=[redacted]&sslmode=require token=[redacted]",
      },
    });
  });

  it("should redact username-only connection userinfo from failure details", async () => {
    const db = {
      transaction: vi
        .fn()
        .mockRejectedValue(
          ProblemFactory.internalServerError(
            "testing/drizzle-health-indicator-redaction",
            "failed postgres://croco_user@db.example/app?password=query-secret&sslmode=require",
          ),
        ),
    };

    const indicator = new DrizzleHealthIndicator(db as never);
    const result = await indicator.check();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("croco_user");
    expect(serialized).not.toContain("query-secret");
    expect(result).toEqual({
      name: "database",
      status: "down",
      details: {
        error: "failed postgres://[redacted]@db.example/app?password=[redacted]&sslmode=require",
      },
    });
  });

  it.each([
    [
      "password-only URL userinfo",
      "failed postgres://:uri-value@db.example/app?sslpassword=query-value&sslmode=require",
      "failed postgres://[redacted]@db.example/app?sslpassword=[redacted]&sslmode=require",
    ],
    [
      "prefixed credential keys",
      "failed host=db.example dbname=app sslmode=require sslpassword=key-value POSTGRES_PASSWORD=env-value",
      "failed host=db.example dbname=app sslmode=require sslpassword=[redacted] POSTGRES_PASSWORD=[redacted]",
    ],
    [
      "quoted credential values",
      "failed sslpassword = 'two\\' words' host=db.example",
      "failed sslpassword = [redacted] host=db.example",
    ],
    [
      "a quoted connection string containing a query",
      "failed DATABASE_DSN='postgres://db.example/app?token=query-value' dbname=app",
      "failed DATABASE_DSN=[redacted] dbname=app",
    ],
    [
      "punctuation in URL userinfo",
      "failed postgres://user:sample?part#tail@db.example/app?sslmode=require",
      "failed postgres://[redacted]@db.example/app?sslmode=require",
    ],
    [
      "at-signs in a password-only URL",
      "failed postgres://:sample@part@db.example/app?sslmode=require",
      "failed postgres://[redacted]@db.example/app?sslmode=require",
    ],
    [
      "punctuation and escaped whitespace in unquoted credentials",
      "failed sslpassword=sample,part;tail&last POSTGRES_PASSWORD=two\\ words host=db.example",
      "failed sslpassword=[redacted] POSTGRES_PASSWORD=[redacted] host=db.example",
    ],
    [
      "a double-quoted credential followed by a value suffix",
      'failed password="sample"tail sslmode=require',
      "failed password=[redacted] sslmode=require",
    ],
    [
      "credential-like text in a URL database name",
      "failed postgres://user@db.example/apptoken=reporting?sslmode=require",
      "failed postgres://[redacted]@db.example/apptoken=reporting?sslmode=require",
    ],
    [
      "credential-like text in a keyword database name",
      "failed host=db.example dbname='app apptoken=reporting' sslmode=require",
      "failed host=db.example dbname='app apptoken=reporting' sslmode=require",
    ],
    [
      "a bare credential inside a diagnostic field",
      "failed reason=password=sample dbname=app",
      "failed reason=password=[redacted] dbname=app",
    ],
  ])("should redact connection failure details for %s", async (_case, message, redactedMessage) => {
    const db = {
      transaction: vi.fn().mockRejectedValue(new Error(message)),
    };
    const indicator = new DrizzleHealthIndicator(db as never);

    await expect(indicator.check()).resolves.toMatchObject({
      status: "down",
      details: { error: redactedMessage },
    });
  });
});
