// croco-test-clock: controlled
import { describe, expect, it, vi } from "vitest";
import { ResearchConflictProblem, ResearchDeniedProblem, ResearchInvalidProblem } from "../index";
import {
  scope,
  access,
  study,
  candidates,
  command,
  createResearchFixture as fixture,
} from "./researchFixtures";
async function setup(f = fixture(), rows = candidates()) {
  await f.service.publishStudy(scope, study, access, command(0, "publish"));
  await f.service.importCandidates(scope, study.id, rows, access, command(1, "import"));
  return f;
}
async function seedAuditHistory(f: ReturnType<typeof fixture>, count: number) {
  await f.store.transact(scope, study.id, async (record) => {
    const audit = record.history[0];
    const mutation = record.mutations[0];
    for (let revision = record.revision + 1; revision <= count; revision++) {
      const key = `prior-command-${revision}`;
      record.history.push({ ...audit, revision, idempotencyKey: key });
      record.mutations.push({ ...mutation, key });
    }
    record.revision = count;
  });
}
async function selectedWithNote() {
  const f = await setup();
  await f.service.selectCandidates(scope, study.id, access, command(2, "select"));
  const subject = (await f.store.read(scope, study.id)).invitations[0].subject;
  await f.service.writeNote(
    scope,
    study.id,
    subject,
    "Private retained note",
    access,
    command(3, "note"),
  );
  return { f, subject };
}
describe("ResearchService", () => {
  it.each(["2026-10-13T00:00:00Z", "2034-03-26T01:30:00+01:00"])(
    "shares note retention time across permission variants and restarts from %s",
    async (initial) => {
      const f = await setup(fixture(initial));
      await f.service.writeNote(
        scope,
        study.id,
        "achieved-0",
        "Retained evidence",
        access,
        command(2, "note"),
      );
      const reader = f.createService({
        authorize: async (_access, permission) => permission !== "research.write",
      });
      await expect(
        reader.writeNote(scope, study.id, "achieved-0", null, access, command(3, "denied")),
      ).rejects.toThrow(ResearchDeniedProblem);
      const retentionMs = 7 * 24 * 60 * 60 * 1000;
      await f.time.advanceBy(retentionMs - 1);
      expect((await reader.inspect(scope, study.id, access)).candidates[0].note).toBe(
        "Retained evidence",
      );
      const restarted = f.createService();
      expect((await restarted.inspect(scope, study.id, access)).candidates[0].note).toBe(
        "Retained evidence",
      );
      await f.time.advanceBy(1);
      expect((await reader.inspect(scope, study.id, access)).candidates[0].note).toBeUndefined();
      await f.time.advanceBy(1);
      expect((await restarted.inspect(scope, study.id, access)).candidates[0].note).toBeUndefined();
    },
  );
  it("keeps concurrent fixtures on independent timelines", async () => {
    const fixtures = await Promise.all([setup(fixture()), setup(fixture("2034-03-26T00:30:00Z"))]);
    await Promise.all(
      fixtures.map(async (f) => {
        await f.service.writeNote(
          scope,
          study.id,
          "achieved-0",
          "Retained evidence",
          access,
          command(2, "note"),
        );
      }),
    );
    await fixtures[0].time.advanceBy(7 * 24 * 60 * 60 * 1000);
    const [expired, retained] = await Promise.all(
      fixtures.map((f) => f.createService().inspect(scope, study.id, access)),
    );
    expect(expired.candidates[0].note).toBeUndefined();
    expect(retained.candidates[0].note).toBe("Retained evidence");
    expect(fixtures[1].clock().toISOString()).toBe("2034-03-26T00:30:00.000Z");
  });
  it("rejects admission before consuming note deletion or dispatch completion capacity", async () => {
    const { f, subject } = await selectedWithNote();
    await seedAuditHistory(f, 49997);
    await expect(
      f.service.invite(scope, study.id, subject, access, command(49997, "invite")),
    ).rejects.toThrow(ResearchInvalidProblem);
    const stored = await f.store.read(scope, study.id);
    expect(stored.history).toHaveLength(49997);
    expect(stored.revision).toBe(49997);
    expect(stored.invitations.find((value) => value.subject === subject)).toMatchObject({
      state: "selected",
      contactCount: 0,
    });
    expect(f.send).not.toHaveBeenCalled();
    await f.service.writeNote(scope, study.id, subject, null, access, command(49997, "delete"));
    expect((await f.store.read(scope, study.id)).notes).toEqual([]);
  }, 20000);
  it.each(["explicit deletion", "expiration purge"])(
    "preserves note %s after a successful dispatch at audit capacity",
    async (cleanup) => {
      const { f, subject } = await selectedWithNote();
      await seedAuditHistory(f, 49996);
      await f.service.invite(scope, study.id, subject, access, command(49996, "invite"));
      expect(f.send).toHaveBeenCalledTimes(1);
      expect((await f.store.read(scope, study.id)).history).toHaveLength(49999);
      if (cleanup === "explicit deletion")
        await f.service.writeNote(scope, study.id, subject, null, access, command(49998, "delete"));
      else {
        await f.time.advanceBy(8 * 24 * 60 * 60 * 1000);
        await f.service.purgeExpiredNotes(scope, study.id, access, command(49998, "purge"));
      }
      const stored = await f.store.read(scope, study.id);
      expect(stored.history).toHaveLength(50000);
      expect(stored.notes).toEqual([]);
    },
    20000,
  );
  it("protects a pending dispatch completion from concurrent writes and note creation", async () => {
    const { f, subject } = await selectedWithNote();
    await seedAuditHistory(f, 49996);
    let started = () => {};
    let release = () => {};
    const reached = new Promise<void>((resolve) => {
      started = resolve;
    });
    const result = new Promise<{ status: "queued"; executionIds: string[] }>((resolve) => {
      release = () => resolve({ status: "queued", executionIds: ["execution"] });
    });
    f.send.mockImplementation(async () => {
      started();
      return result;
    });
    const dispatch = f.service.invite(scope, study.id, subject, access, command(49996, "invite"));
    await reached;
    await expect(
      f.service.publishStudy(scope, study, access, command(49997, "concurrent-write")),
    ).rejects.toThrow(ResearchInvalidProblem);
    const other = candidates().find((value) => value.subject !== subject);
    await expect(
      f.service.writeNote(
        scope,
        study.id,
        other?.subject ?? "",
        "Another note",
        access,
        command(49997, "concurrent-note"),
      ),
    ).rejects.toThrow(ResearchInvalidProblem);
    await f.service.writeNote(scope, study.id, subject, null, access, command(49997, "delete"));
    release();
    await dispatch;
    const stored = await f.store.read(scope, study.id);
    expect(stored.history).toHaveLength(50000);
    expect(stored.notes).toEqual([]);
    expect(stored.invitations.find((value) => value.subject === subject)).toMatchObject({
      state: "invited",
      executionIds: ["execution"],
    });
  }, 20000);
  it("keeps cleanup and audited reconciliation available after interrupted dispatch at capacity", async () => {
    const { f, subject } = await selectedWithNote();
    await seedAuditHistory(f, 49996);
    f.send.mockRejectedValue(new ResearchConflictProblem("Synthetic interrupted provider"));
    await expect(
      f.service.invite(scope, study.id, subject, access, command(49996, "invite")),
    ).rejects.toThrow(ResearchConflictProblem);
    await f.time.advanceBy(8 * 24 * 60 * 60 * 1000);
    await f.service.purgeExpiredNotes(scope, study.id, access, command(49997, "purge"));
    await f.service.reconcileInvitation(
      scope,
      study.id,
      subject,
      "suppressed",
      access,
      command(49998, "reconcile"),
    );
    await f.service.invite(scope, study.id, subject, access, command(49996, "invite"));
    const stored = await f.store.read(scope, study.id);
    expect(stored.history).toHaveLength(50000);
    expect(stored.notes).toEqual([]);
    expect(stored.invitations.find((value) => value.subject === subject)).toMatchObject({
      state: "suppressed",
    });
    expect(f.send).toHaveBeenCalledTimes(1);
  }, 20000);
  it.each(["queued", "failed"])(
    "preserves reconciliation when the late provider result is %s",
    async (outcome) => {
      const { f, subject } = await selectedWithNote();
      await seedAuditHistory(f, 49996);
      let started = () => {};
      let release = () => {};
      const reached = new Promise<void>((resolve) => {
        started = resolve;
      });
      const completed = new Promise<void>((resolve) => {
        release = resolve;
      });
      f.send.mockImplementation(async () => {
        started();
        await completed;
        if (outcome === "failed")
          throw new ResearchConflictProblem("Synthetic late provider failure");
        return { status: "queued", executionIds: ["execution"] };
      });
      const dispatch = f.service.invite(scope, study.id, subject, access, command(49996, "invite"));
      await reached;
      await f.service.writeNote(scope, study.id, subject, null, access, command(49997, "delete"));
      await f.service.reconcileInvitation(
        scope,
        study.id,
        subject,
        "suppressed",
        access,
        command(49998, "reconcile"),
      );
      release();
      await dispatch;
      const stored = await f.store.read(scope, study.id);
      expect(stored.history).toHaveLength(50000);
      expect(stored.invitations.find((value) => value.subject === subject)).toMatchObject({
        state: "suppressed",
        executionIds: [],
      });
      expect(
        stored.invitations.find((value) => value.subject === subject)?.failureCode,
      ).toBeUndefined();
      expect(f.send).toHaveBeenCalledTimes(1);
    },
    20000,
  );
  it.each(["explicit deletion", "expiration purge"])(
    "reserves audit capacity for private-note %s",
    async (cleanup) => {
      const f = await setup();
      const subject = candidates()[0].subject;
      await f.service.writeNote(
        scope,
        study.id,
        subject,
        "Private retained note",
        access,
        command(2, "note"),
      );
      await f.store.transact(scope, study.id, async (record) => {
        const audit = record.history[0];
        const mutation = record.mutations[0];
        for (let revision = record.revision + 1; revision <= 49999; revision++) {
          const key = `prior-command-${revision}`;
          record.history.push({ ...audit, revision, idempotencyKey: key });
          record.mutations.push({ ...mutation, key });
        }
        record.revision = 49999;
      });
      if (cleanup === "expiration purge") await f.time.advanceBy(8 * 24 * 60 * 60 * 1000);
      await expect(
        f.service.publishStudy(scope, study, access, command(49999, "ordinary-write")),
      ).rejects.toThrow(ResearchInvalidProblem);
      expect((await f.store.read(scope, study.id)).revision).toBe(49999);
      if (cleanup === "explicit deletion") {
        await f.service.writeNote(scope, study.id, subject, null, access, command(49999, "delete"));
      } else {
        await f.service.purgeExpiredNotes(scope, study.id, access, command(49999, "purge"));
      }
      const stored = await f.store.read(scope, study.id);
      expect(stored.notes).toEqual([]);
      expect(stored.history).toHaveLength(50000);
      expect(stored.history.at(-1)).toMatchObject({
        operation: cleanup === "explicit deletion" ? "note" : "purge-notes",
      });
    },
    20000,
  );
  it("rejects a private note when its future deletion cannot fit in the audit budget", async () => {
    const f = await setup();
    await f.store.transact(scope, study.id, async (record) => {
      const audit = record.history[0];
      const mutation = record.mutations[0];
      for (let revision = record.revision + 1; revision <= 49999; revision++) {
        const key = `prior-command-${revision}`;
        record.history.push({ ...audit, revision, idempotencyKey: key });
        record.mutations.push({ ...mutation, key });
      }
      record.revision = 49999;
    });
    await expect(
      f.service.writeNote(
        scope,
        study.id,
        candidates()[0].subject,
        "Private note",
        access,
        command(49999, "note-without-reserve"),
      ),
    ).rejects.toThrow(ResearchInvalidProblem);
    expect((await f.store.read(scope, study.id)).notes).toEqual([]);
    expect((await f.store.read(scope, study.id)).revision).toBe(49999);
  }, 20000);
  it("preserves accepted participation after a contact-only opt-out", async () => {
    const f = await setup();
    await f.service.selectCandidates(scope, study.id, access, command(2, "select"));
    const subject = (await f.store.read(scope, study.id)).invitations[0].subject;
    await f.service.invite(scope, study.id, subject, access, command(3, "invite"));
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
    await f.service.recordConsent(
      scope,
      study.id,
      subject,
      { contact: false, participation: true },
      access,
      command(7, "contact-opt-out"),
    );
    expect((await f.store.read(scope, study.id)).invitations[0].state).toBe("accepted");
    expect((await f.service.inspect(scope, study.id, access)).groups[0]).toMatchObject({
      accepted: 1,
      held: 2,
    });
    await f.service.markParticipated(scope, study.id, subject, access, command(8, "participated"));
    expect((await f.service.inspect(scope, study.id, access)).groups[0].participated).toBe(1);
  });
  it("rejects ordinary responses after completed participation and preserves consent withdrawal separately", async () => {
    const f = await setup();
    await f.service.selectCandidates(scope, study.id, access, command(2, "select"));
    const subject = (await f.store.read(scope, study.id)).invitations[0].subject;
    await f.service.invite(scope, study.id, subject, access, command(3, "invite"));
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
    await f.service.markParticipated(scope, study.id, subject, access, command(7, "participated"));
    const recruiter = f.createService({
      authorize: async (_access, permission) => permission !== "research.participate",
    });
    for (const response of ["declined", "withdrawn"] as const) {
      await expect(
        recruiter.recordResponse(scope, study.id, subject, response, access, command(8, response)),
      ).rejects.toThrow(ResearchConflictProblem);
    }
    await recruiter.recordConsent(
      scope,
      study.id,
      subject,
      { contact: false, participation: false },
      access,
      command(8, "withdraw-consent"),
    );
    expect((await recruiter.inspect(scope, study.id, access)).groups[0]).toMatchObject({
      participated: 1,
      held: 2,
    });
    expect((await f.store.read(scope, study.id)).invitations[0]).toMatchObject({
      state: "participated",
      participationConsent: false,
    });
  });
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
    const reader = f.createService({
      authorize: async (_access, permission) => permission !== "research.write",
    });
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
    const restricted = f.createService({
      authorize: async (_input, _permission, subject) => subject === undefined,
    });
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
    const restarted = f.createService({ authorize: async () => true });
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
    await f.time.advanceBy(7 * 24 * 60 * 60 * 1000);
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
