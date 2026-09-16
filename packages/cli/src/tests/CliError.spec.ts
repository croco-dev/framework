import { describe, expect, it } from "vitest";
import { runCreateDomain } from "../commands/createDomain.js";
import { runCreatePage } from "../commands/createPage.js";
import { generateController } from "../commands/makeController.js";
import { generateEntity } from "../commands/makeEntity.js";
import { generateEvent } from "../commands/makeEvent.js";
import { generateListener } from "../commands/makeListener.js";
import { generateRepository } from "../commands/makeRepository.js";
import { applyReplacements } from "../commands/upgradeRules.js";
import { CliError } from "../libs/CliError.js";
import { normalize } from "../libs/naming.js";

describe("CLI diagnostic errors", () => {
  it.each([
    runCreateDomain,
    runCreatePage,
    generateController,
    generateEntity,
    generateEvent,
    generateListener,
    generateRepository,
  ])("rejects invalid generator names with a stable code (%#)", async (generate) => {
    await expect(generate("123Invalid")).rejects.toMatchObject({
      name: "CliError",
      code: "CROCO_CLI_NAME_INVALID",
      message: "Invalid name: 123Invalid",
    });
  });

  it("preserves Error compatibility and exposes the diagnostic code", () => {
    const error = new CliError("CROCO_CLI_MANIFEST_INVALID", "Invalid manifest");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CliError");
    expect(error.code).toBe("CROCO_CLI_MANIFEST_INVALID");
    expect(error.message).toBe("Invalid manifest");
  });

  it("identifies empty normalization results", () => {
    expect(() => normalize("", "pascal")).toThrowError(
      expect.objectContaining({
        code: "CROCO_CLI_NORMALIZATION_INVALID",
        message: "Invalid input: cannot normalize empty result",
      }),
    );
  });

  it("identifies overlapping codemod replacements before modifying content", () => {
    expect(() =>
      applyReplacements("abcdef", [
        { start: 0, end: 3, text: "first" },
        { start: 2, end: 4, text: "second" },
      ]),
    ).toThrowError(
      expect.objectContaining({
        code: "CROCO_CLI_UPGRADE_REPLACEMENTS_OVERLAP",
        message: "Upgrade codemod replacements overlap.",
      }),
    );
  });
});
