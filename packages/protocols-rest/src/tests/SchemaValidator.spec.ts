import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateResponse, validateResponseAsync } from "../libs/validators/SchemaValidator";
import { ResponseValidationProblem } from "../libs/validators/ValidationProblem";

describe("response schema validation", () => {
  it("keeps validateResponse synchronous for sync schemas", () => {
    const schema = z.string().transform((value) => value.toUpperCase());

    expect(validateResponse(schema, "ada")).toBe("ADA");
    expect(() => validateResponse(schema, 123)).toThrow(ResponseValidationProblem);
  });

  it("parses async response effects and preserves validation issues", async () => {
    const schema = z.object({
      name: z.string().refine(async (name) => name !== "taken", "name is taken"),
    });

    await expect(validateResponseAsync(schema, { name: "ada" })).resolves.toEqual({ name: "ada" });
    await expect(validateResponseAsync(schema, { name: "taken" })).rejects.toThrowError(
      expect.objectContaining({
        code: "protocols-rest/response-validation-failed",
        extensions: { issues: [{ path: "name", message: "name is taken" }] },
      }),
    );
  });
});
