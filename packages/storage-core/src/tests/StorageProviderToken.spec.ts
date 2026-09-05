import { Token } from "@croco/framework-context";
import { describe, expect, it } from "vitest";
import { STORAGE_PROVIDER_TOKEN } from "../index";

describe("STORAGE_PROVIDER_TOKEN", () => {
  it("exports a stable typed framework token", () => {
    expect(STORAGE_PROVIDER_TOKEN).toBeInstanceOf(Token);
    expect(STORAGE_PROVIDER_TOKEN.name).toBe("StorageProvider");
  });
});
