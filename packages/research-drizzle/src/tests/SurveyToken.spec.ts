import { describe, it, expect } from "vitest";
import { surveyTokenCodec } from "../index";
describe("survey tokens", () => {
  it("stores only a stable digest of independent 256-bit bearers", () => {
    const a = surveyTokenCodec.create();
    const b = surveyTokenCodec.create();
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw).toHaveLength(43);
    expect(a.hash).toHaveLength(64);
    expect(a.hash).not.toContain(a.raw);
    expect(surveyTokenCodec.hash(a.raw)).toBe(a.hash);
  });
});
