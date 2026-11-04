// croco-test-clock: controlled
import { describe, expect, it } from "vitest";
import { ResearchDeniedProblem } from "@croco/research-core";
import { ResearchOperations } from "../libs/ResearchOperations";
import {
  scope,
  study,
  access,
  command,
  candidates,
  createResearchFixture,
} from "../../../research-core/src/tests/researchFixtures";
describe("ResearchOperations", () => {
  it("executes a real domain selection and denies writes from a forged browser principal or tenant", async () => {
    const { store, service } = createResearchFixture();
    await service.publishStudy(scope, study, access, command(0, "publish"));
    await service.importCandidates(scope, study.id, candidates(), access, command(1, "import"));
    const operations = new ResearchOperations(service);
    await operations.execute(scope, study.id, { kind: "select" }, command(2, "select"), access);
    expect(
      (await operations.read(scope, study.id, access)).groups.map((value) => value.held),
    ).toEqual([2, 2]);
    expect((await store.read(scope, study.id)).history.at(-1)?.source).toBe(
      "research-console/server-command",
    );
    await expect(
      operations.execute(scope, study.id, { kind: "select" }, command(3, "forged"), {
        ...access,
        principal: "browser",
      }),
    ).rejects.toThrow(ResearchDeniedProblem);
    await expect(
      operations.read({ ...scope, tenantId: "other" }, study.id, access),
    ).rejects.toThrow(ResearchDeniedProblem);
  });
});
