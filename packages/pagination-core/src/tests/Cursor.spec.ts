import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../libs/cursor";
import { InvalidCursorProblem } from "../libs/problems";

describe("cursor", () => {
  it("should roundtrip encode and decode", () => {
    const payload = { v: 1, id: "usr_01HXYZ" };
    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it("should encode to URL-safe Base64 (no + or /)", () => {
    const payload = { v: 1, id: "test+++///" };
    const encoded = encodeCursor(payload);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });

  it("should decode compound key payload", () => {
    const payload = { v: 1, id: "xxx", createdAt: "2025-01-01" };
    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it("should throw InvalidCursorProblem for malformed Base64", () => {
    expect(() => decodeCursor("not-base64!!!")).toThrow(InvalidCursorProblem);
  });

  it("should throw InvalidCursorProblem for valid Base64 but non-JSON", () => {
    expect(() => decodeCursor("aGVsbG8=")).toThrow(InvalidCursorProblem); // "hello" in base64
  });

  it("should throw InvalidCursorProblem for JSON without v field", () => {
    const invalidJson = Buffer.from(JSON.stringify({ id: "test" })).toString("base64url");
    expect(() => decodeCursor(invalidJson)).toThrow(InvalidCursorProblem);
  });

  it("should throw InvalidCursorProblem for unsupported version", () => {
    const payload = { v: 99, id: "test" };
    const encoded = encodeCursor(payload);
    expect(() => decodeCursor(encoded)).toThrow(InvalidCursorProblem);
  });

  it("should throw InvalidCursorProblem for empty string", () => {
    expect(() => decodeCursor("")).toThrow(InvalidCursorProblem);
  });
});
