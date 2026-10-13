import { describe, expect, it, vi } from "vitest";
import {
  InMemoryResearchStore,
  ResearchService,
  ResearchConflictProblem,
  ResearchDeniedProblem,
  ResearchInvalidProblem,
} from "../index";
import { scope, access, study, candidates, command } from "./researchFixtures";
function fixture() {
  const store = new InMemoryResearchStore();
  const send = vi.fn(async () => ({ status: "queued" as const, executionIds: ["execution"] }));
  let now = new Date("2026-10-13T00:00:00Z");
  const service = new ResearchService(
    store,
    {
      authorize: async (input, permission) =>
        input.principal === "verified-session" &&
        !(input.actor === "reader" && permission !== "research.read"),
    },
    { send },
    [study.bookingUrl],
    () => now,
  );
  return {
    store,
    service,
    send,
    setNow: (value: Date) => {
      now = value;
    },
  };
}
async function setup(f = fixture(), rows = candidates()) {
  await f.service.publishStudy(scope, study, access, command(0, "publish"));
  await f.service.importCandidates(scope, study.id, rows, access, command(1, "import"));
  return f;
}
describe("ResearchService", () => {
  it("requires write authority in addition to private-note field permission", async () => {
    const f = await setup();
    await f.service.writeNote(
      scope,
      study.id,
      "achieved-0",
      "Private source evidence",
      access,
      command(2, "note"),
    );
    const reader = new ResearchService(
      f.store,
      { authorize: async (_access, permission) => permission !== "research.write" },
      { send: f.send },
      [study.bookingUrl],
    );
    expect((await reader.inspect(scope, study.id, access)).candidates[0].note).toBe(
      "Private source evidence",
    );
    await expect(
      reader.writeNote(
        scope,
        study.id,
        "achieved-0",
        null,
        access,
        command(3, "erase-without-write"),
      ),
    ).rejects.toThrow(ResearchDeniedProblem);
    expect((await f.store.read(scope, study.id)).revision).toBe(3);
  });
  it("rejects unauthorized subject import/selection atomically and requires selection before participation consent", async () => {
    const f = await setup();
    await expect(
      f.service.recordConsent(
        scope,
        study.id,
        "achieved-0",
        { contact: true, participation: true },
        access,
        command(2, "unselected-consent"),
      ),
    ).rejects.toThrow(ResearchConflictProblem);
    expect((await f.store.read(scope, study.id)).revision).toBe(2);
    const restricted = new ResearchService(
      f.store,
      { authorize: async (_input, _permission, subject) => subject === undefined },
      { send: f.send },
      [study.bookingUrl],
    );
    await expect(
      restricted.importCandidates(
        scope,
        study.id,
        candidates(),
        access,
        command(2, "denied-import"),
      ),
    ).rejects.toThrow(ResearchDeniedProblem);
    await expect(
      restricted.selectCandidates(scope, study.id, access, command(2, "denied-select")),
    ).rejects.toThrow(ResearchDeniedProblem);
    expect((await f.store.read(scope, study.id)).invitations).toEqual([]);
    expect((await f.store.read(scope, study.id)).revision).toBe(2);
  });
  it("holds exactly two slots in each group, rejects stale concurrent selection and deterministically reproduces from a permuted snapshot", async () => {
    const f = await setup();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        f.service.selectCandidates(scope, study.id, access, command(2, `select-${i}`)),
      ),
    );
    expect(results.filter((value) => value.status === "fulfilled")).toHaveLength(1);
    const page = await f.service.inspect(scope, study.id, access);
    expect(page.groups.map((group) => [group.held, group.shortage])).toEqual([
      [2, 0],
      [2, 0],
    ]);
    const other = await setup(fixture(), candidates().reverse());
    await other.service.selectCandidates(scope, study.id, access, command(2, "select"));
    const subjects = (await f.store.read(scope, study.id)).invitations
      .map((value) => value.subject)
      .sort();
    expect(
      (await other.store.read(scope, study.id)).invitations.map((value) => value.subject).sort(),
    ).toEqual(subjects);
    expect(page.groups.every((group) => group.accepted === 0 && group.participated === 0)).toBe(
      true,
    );
    const seededSelections = new Set<string>();
    for (const seed of ["research-seed", "alternate-0", "alternate-1", "alternate-2"]) {
      const fresh = fixture();
      await fresh.service.publishStudy(scope, { ...study, seed }, access, command(0, "publish"));
      await fresh.service.importCandidates(
        scope,
        study.id,
        candidates(),
        access,
        command(1, "import"),
      );
      await fresh.service.selectCandidates(scope, study.id, access, command(2, "select"));
      seededSelections.add(
        JSON.stringify(
          (await fresh.store.read(scope, study.id)).invitations
            .map((value) => value.subject)
            .sort(),
        ),
      );
    }
    expect(seededSelections.size).toBeGreaterThan(1);
  });
  it("excludes incomplete observations, recent participants, prior contacts and ineligible people before claiming slots", async () => {
    const rows = candidates();
    rows[0] = { ...rows[0], observedThrough: "2026-09-30T23:59:59Z" };
    rows[1] = { ...rows[1], priorParticipatedAt: "2026-09-01T00:00:00Z" };
    rows[2] = { ...rows[2], priorContactAt: "2026-09-15T00:00:00Z" };
    rows[4] = { ...rows[4], eligible: false };
    rows[5] = { ...rows[5], contactConsent: false };
    const f = await setup(fixture(), rows);
    await f.service.selectCandidates(scope, study.id, access, command(2, "select"));
    const page = await f.service.inspect(scope, study.id, access);
    expect(page.groups.map((group) => group.held)).toEqual([1, 2]);
    expect(page.candidates.slice(0, 3).map((row) => row.exclusion)).toEqual([
      "observation-incomplete",
      "recent-participant",
      "recent-contact",
    ]);
    expect(
      page.candidates
        .filter((row) => row.invitation)
        .map((row) => row.candidate.subject)
        .sort(),
    ).toEqual(["achieved-3", "comparison-2", "comparison-3"]);
  });
  it("blocks withdrawal completed before dispatch admission and never claims cancellation after admission", async () => {
    const f = await setup();
    await f.service.selectCandidates(scope, study.id, access, command(2, "select"));
    const subject = (await f.store.read(scope, study.id)).invitations[0].subject;
    await f.service.recordConsent(
      scope,
      study.id,
      subject,
      { contact: false, participation: false },
      access,
      command(3, "withdraw"),
    );
    await expect(
      f.service.invite(scope, study.id, subject, access, command(4, "invite")),
    ).rejects.toThrow(ResearchConflictProblem);
    expect(f.send).not.toHaveBeenCalled();
    expect((await f.store.read(scope, study.id)).invitations[0].state).toBe("withdrawn");
    const next = (await f.store.read(scope, study.id)).invitations[1].subject;
    let dispatchEntered = () => {};
    const entered = new Promise<void>((resolve) => {
      dispatchEntered = resolve;
    });
    let finish = () => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    f.send.mockImplementation(async () => {
      dispatchEntered();
      await gate;
      return { status: "queued", executionIds: ["accepted"] };
    });
    const sending = f.service.invite(scope, study.id, next, access, command(4, "invite-next"));
    await entered;
    await f.service.recordConsent(
      scope,
      study.id,
      next,
      { contact: false, participation: false },
      access,
      command(5, "withdraw-next"),
    );
    finish();
    await sending;
    const invitation = (await f.store.read(scope, study.id)).invitations.find(
      (value) => value.subject === next,
    );
    expect(invitation).toMatchObject({
      state: "invited",
      contactCount: 1,
      executionIds: ["accepted"],
    });
  });
  it("replays duplicate import/invite without sending twice and holds unknown outcomes across service recreation", async () => {
    const f = await setup();
    await f.service.importCandidates(scope, study.id, candidates(), access, command(1, "import"));
    expect((await f.store.read(scope, study.id)).candidates).toHaveLength(8);
    await f.service.selectCandidates(scope, study.id, access, command(2, "select"));
    const subject = (await f.store.read(scope, study.id)).invitations[0].subject;
    await Promise.all([
      f.service.invite(scope, study.id, subject, access, command(3, "invite")),
      f.service.invite(scope, study.id, subject, access, command(3, "invite")),
    ]);
    expect(f.send).toHaveBeenCalledTimes(1);
    await f.service.invite(scope, study.id, subject, access, command(3, "invite"));
    expect(f.send).toHaveBeenCalledTimes(1);
    const next = (await f.store.read(scope, study.id)).invitations[1].subject;
    f.send.mockRejectedValueOnce(new ResearchConflictProblem("provider timeout"));
    await expect(
      f.service.invite(scope, study.id, next, access, command(5, "unknown")),
    ).rejects.toThrow("unknown");
    const restarted = new ResearchService(
      f.store,
      { authorize: async () => true },
      { send: f.send },
      [study.bookingUrl],
    );
    await restarted.invite(scope, study.id, next, access, command(5, "unknown"));
    expect(f.send).toHaveBeenCalledTimes(2);
    const page = await restarted.inspect(scope, study.id, access);
    expect(page.groups[0]).toMatchObject({ held: 2, unknown: 1 });
    await expect(
      restarted.recordResponse(
        scope,
        study.id,
        next,
        "declined",
        access,
        command(6, "decline-unknown"),
      ),
    ).rejects.toThrow(ResearchConflictProblem);
    await restarted.reconcileInvitation(
      scope,
      study.id,
      next,
      "suppressed",
      access,
      command(6, "reconcile"),
    );
    expect((await restarted.inspect(scope, study.id, access)).groups[0].held).toBe(1);
  });
  it("separates accepted and participated, audits confirmation, then replaces declined slots without resetting caps", async () => {
    const f = await setup();
    await f.service.selectCandidates(scope, study.id, access, command(2, "select"));
    const subject = (await f.store.read(scope, study.id)).invitations[0].subject;
    await f.service.invite(scope, study.id, subject, access, command(3, "invite"));
    await expect(
      f.service.markParticipated(scope, study.id, subject, access, command(5, "too-early")),
    ).rejects.toThrow(ResearchConflictProblem);
    await f.service.recordConsent(
      scope,
      study.id,
      subject,
      { contact: true, participation: true },
      access,
      command(5, "consent"),
    );
    await f.service.recordResponse(
      scope,
      study.id,
      subject,
      "accepted",
      access,
      command(6, "accept"),
    );
    expect((await f.service.inspect(scope, study.id, access)).groups[0]).toMatchObject({
      accepted: 1,
      participated: 0,
    });
    await f.service.markParticipated(scope, study.id, subject, access, command(7, "participated"));
    expect((await f.service.inspect(scope, study.id, access)).groups[0]).toMatchObject({
      accepted: 1,
      participated: 1,
    });
    const next = (await f.store.read(scope, study.id)).invitations[1].subject;
    await f.service.recordResponse(
      scope,
      study.id,
      next,
      "declined",
      access,
      command(8, "decline"),
    );
    await f.service.selectCandidates(scope, study.id, access, command(9, "replace"));
    expect((await f.service.inspect(scope, study.id, access)).groups[0].held).toBe(2);
    expect(
      (await f.store.read(scope, study.id)).invitations.filter((value) => value.subject === next),
    ).toHaveLength(1);
    await expect(
      f.service.publishStudy(scope, { ...study, version: 2 }, access, command(10, "revision")),
    ).rejects.toThrow(ResearchConflictProblem);
  });
  it("requires explicit scope, server authorization, bounded queries and field permissions; deletes notes without retaining their text in audit", async () => {
    const f = await setup();
    const subject = candidates()[0].subject;
    await f.service.writeNote(
      scope,
      study.id,
      subject,
      "PRIVATE RESPONSE",
      access,
      command(2, "note"),
    );
    expect((await f.service.inspect(scope, study.id, access)).candidates[0].note).toBe(
      "PRIVATE RESPONSE",
    );
    const reader = { ...access, actor: "reader" };
    expect((await f.service.inspect(scope, study.id, reader)).candidates[0].note).toBeUndefined();
    await expect(
      f.service.writeNote(scope, study.id, subject, null, reader, command(3, "delete-denied")),
    ).rejects.toThrow(ResearchDeniedProblem);
    await f.service.writeNote(scope, study.id, subject, null, access, command(3, "delete"));
    expect(JSON.stringify(await f.store.read(scope, study.id))).not.toContain("PRIVATE RESPONSE");
    await f.service.writeNote(scope, study.id, subject, "expires", access, command(4, "expiring"));
    f.setNow(new Date("2026-10-20T00:00:00Z"));
    expect((await f.service.inspect(scope, study.id, access)).candidates[0].note).toBeUndefined();
    await f.service.purgeExpiredNotes(scope, study.id, access, command(5, "purge"));
    expect((await f.store.read(scope, study.id)).notes).toEqual([]);
    await expect(
      f.service.inspect({ ...scope, tenantId: "other" }, study.id, access),
    ).rejects.toThrow(ResearchDeniedProblem);
    await expect(f.service.inspect({ ...scope, tenantId: "" }, study.id, access)).rejects.toThrow(
      ResearchInvalidProblem,
    );
    await expect(f.service.inspect(scope, study.id, access, 0, 101)).rejects.toThrow(
      ResearchInvalidProblem,
    );
    expect((await f.service.inspect(scope, study.id, access, 0, 3)).nextOffset).toBe(3);
  });
  it.each([
    "http://booking.example.invalid/a",
    "https://evil.invalid/a",
    "https://user:pass@booking.example.invalid/a",
    "javascript:alert(1)",
  ])("rejects unsupported booking link %s", async (bookingUrl) => {
    const f = fixture();
    await expect(
      f.service.publishStudy(scope, { ...study, bookingUrl }, access, command(0, "publish")),
    ).rejects.toThrow(ResearchInvalidProblem);
  });
  it("rolls back duplicate/conflicting imports and rejects idempotency collisions", async () => {
    const f = await setup();
    await expect(
      f.service.importCandidates(
        scope,
        study.id,
        [candidates()[0], candidates()[0]],
        access,
        command(2, "duplicates"),
      ),
    ).rejects.toThrow(ResearchInvalidProblem);
    await expect(
      f.service.importCandidates(
        scope,
        study.id,
        [{ ...candidates()[0], group: "comparison" }],
        access,
        command(2, "conflict"),
      ),
    ).rejects.toThrow(ResearchConflictProblem);
    await expect(
      f.service.importCandidates(scope, study.id, [], access, command(1, "import")),
    ).rejects.toThrow(ResearchConflictProblem);
    expect((await f.store.read(scope, study.id)).revision).toBe(2);
  });
  it("reimports immutable provenance after consent changes without restoring withdrawn consent and ignores object key order", async () => {
    const f = await setup();
    const row = candidates()[0];
    await f.service.recordConsent(
      scope,
      study.id,
      row.subject,
      { contact: false, participation: false },
      access,
      command(2, "withdraw-imported"),
    );
    const reordered = Object.fromEntries(Object.entries(row).reverse()) as typeof row;
    await f.service.importCandidates(scope, study.id, [reordered], access, command(3, "reimport"));
    expect((await f.store.read(scope, study.id)).candidates[0].contactConsent).toBe(false);
    await f.service.publishStudy(
      scope,
      Object.fromEntries(Object.entries(study).reverse()) as typeof study,
      access,
      command(4, "same-publication"),
    );
    await f.service.publishStudy(
      scope,
      study,
      access,
      Object.fromEntries(Object.entries(command(4, "same-publication")).reverse()) as ReturnType<
        typeof command
      >,
    );
    expect((await f.store.read(scope, study.id)).revision).toBe(5);
  });
  it("rejects undeclared contact fields and an unapproved path on the approved booking host", async () => {
    const f = await setup();
    const candidate = { ...candidates()[0], email: "private@example.invalid" };
    await expect(
      f.service.importCandidates(
        scope,
        study.id,
        [candidate],
        access,
        command(2, "private-fields"),
      ),
    ).rejects.toThrow(ResearchInvalidProblem);
    await expect(
      f.service.publishStudy(
        scope,
        { ...study, bookingUrl: "https://booking.example.invalid/redirect?to=evil" },
        access,
        command(2, "redirect"),
      ),
    ).rejects.toThrow(ResearchInvalidProblem);
  });
});
