import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
describe("ResearchRecruitmentConsole", () => {
  it("operates actual server research/engagement selection, invitation, consent, participation, replacement and note deletion through keyboard/browser controls", () => {
    const runner = fileURLToPath(new URL("./researchRecruitmentBrowser.cjs", import.meta.url));
    const result = JSON.parse(
      execFileSync(process.execPath, [runner], { encoding: "utf8", timeout: 60000 }),
    );
    expect(result).toMatchObject({
      dispatchCount: 1,
      participated: 1,
      errors: [],
      overflow: false,
    });
  }, 65000);
});
