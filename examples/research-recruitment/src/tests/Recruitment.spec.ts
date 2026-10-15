import { describe, expect, it } from "vitest";
import { createRecruitmentFixture } from "../fixture";
describe("Standalone research recruitment", () => {
  it("imports, selects and dispatches through actual research/admin/engagement services without another new growth service", async () => {
    const fixture = await createRecruitmentFixture();
    const { scope, access, definition, operations } = fixture;
    const command = (expectedRevision: number, idempotencyKey: string) => ({
      expectedRevision,
      idempotencyKey,
      reason: "Synthetic standalone operation",
    });
    await operations.execute(
      scope,
      definition.id,
      { kind: "select" },
      command(2, "select"),
      access,
    );
    const selected = (await operations.read(scope, definition.id, access)).candidates.find(
      (value) => value.invitation,
    )?.candidate.subject;
    expect(selected).toBeDefined();
    if (!selected) return;
    await operations.execute(
      scope,
      definition.id,
      { kind: "invite", subject: selected },
      command(3, "invite"),
      access,
    );
    expect(fixture.dispatchCount()).toBe(1);
    expect(
      (await operations.read(scope, definition.id, access)).groups.reduce(
        (sum, group) => sum + group.invited,
        0,
      ),
    ).toBe(1);
  });
});
