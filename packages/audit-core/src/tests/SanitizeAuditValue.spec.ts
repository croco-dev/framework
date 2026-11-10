import { describe, expect, it } from "vitest";
import { sanitizeAuditValue } from "../libs/sanitizeAuditValue";

describe("sanitizeAuditValue", () => {
  it.each([
    [BigInt("0"), "0"],
    [BigInt("-1"), "-1"],
    [BigInt("9007199254740993123456789"), "9007199254740993123456789"],
    [BigInt("-9007199254740993123456789"), "-9007199254740993123456789"],
  ])("preserves bigint %s as an exact decimal string", (value, expected) => {
    expect(sanitizeAuditValue(value)).toBe(expected);
    expect(JSON.stringify(sanitizeAuditValue(value))).toBe(JSON.stringify(expected));
  });

  it("normalizes nested bigint without bypassing redaction, accessors or cycles", () => {
    const getter = () => {
      throw new Error("accessor must not execute");
    };
    const input: Record<string, unknown> = {
      total: BigInt("9007199254740993"),
      items: [{ delta: BigInt("-9007199254740995") }, BigInt("0")],
      accessToken: BigInt("123456789"),
    };
    input.self = input;
    Object.defineProperty(input, "displayName", { enumerable: true, get: getter });

    const snapshot = sanitizeAuditValue(input);
    expect(snapshot).toEqual({
      total: "9007199254740993",
      items: [{ delta: "-9007199254740995" }, "0"],
      accessToken: "[Redacted]",
      self: "[Circular]",
      displayName: "[Accessor]",
    });
    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(input.total).toBe(BigInt("9007199254740993"));
    expect(input.accessToken).toBe(BigInt("123456789"));
  });
});
