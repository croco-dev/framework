import { describe, expect, it, vi } from "vitest";
import {
  AcquisitionProblem,
  AcquisitionService,
  emptyAcquisitionState,
  parseAcquisitionContext,
  resolveAcquisitionDestination,
  resolveAttribution,
  validateAcquisitionContext,
} from "../acquisition";
import type {
  AcquisitionDefinition,
  AcquisitionState,
  AcquisitionStore,
  AcquisitionTouchpoint,
  AcquisitionUrlPolicy,
} from "../acquisition";

const scope = { app: "shop", environment: "test", tenantId: "one" };
const user = { kind: "subject" as const, ref: "user-a" };
const anon = { kind: "anonymous" as const, ref: "session-a" };
const urls: AcquisitionUrlPolicy = {
  origin: "https://shop.test",
  destinations: { home: "/", pricing: "/pricing" },
  campaigns: { utm_source: ["newsletter"], utm_campaign: ["spring"] },
  referrerOrigins: ["https://search.test"],
};
const stamp = (hour: number) => `2026-10-17T${String(hour).padStart(2, "0")}:00:00.000Z`;
const context = parseAcquisitionContext(
  { url: "https://shop.test/?utm_source=newsletter", referrerAvailable: true },
  urls,
);
const direct = parseAcquisitionContext(
  { url: "https://shop.test/", referrerAvailable: true },
  urls,
);
const definition: AcquisitionDefinition = {
  id: "first",
  model: "first-touch",
  modelVersion: "1",
  revision: 1,
  windowMs: 3 * 3600000,
  actor: "operator",
  reason: "initial",
  idempotencyKey: "first-1",
};
const point = (
  id: string,
  hour: number,
  changes: Partial<AcquisitionTouchpoint> = {},
): AcquisitionTouchpoint => ({
  id,
  scope,
  source: "browser",
  identity: anon,
  occurredAt: stamp(hour),
  recordedAt: stamp(hour),
  expiresAt: stamp(20),
  sourceKind: "observed",
  context,
  coverage: "partial",
  ...changes,
});
function fixture() {
  const states = new Map<string, AcquisitionState>();
  const store: AcquisitionStore = {
    async transact(scope, operation) {
      const key = JSON.stringify(scope);
      const state = structuredClone(states.get(key) ?? emptyAcquisitionState());
      const result = operation(state);
      states.set(key, state);
      return structuredClone(result);
    },
  };
  const authorize = vi.fn(() => undefined);
  let hour = 12;
  const options = {
    actor: "operator",
    urls,
    claimCodes: ["friend", "podcast"],
    retentionMs: 24 * 3600000,
    clock: () => new Date(stamp(hour)),
    policy: { authorize, mask: (row: AcquisitionTouchpoint) => row },
  };
  const service = new AcquisitionService(store, options);
  const record = (id: string, at: number, changes: Partial<AcquisitionTouchpoint> = {}) => {
    const { recordedAt: _recorded, expiresAt: _expires, ...input } = point(id, at, changes);
    return service.recordTouchpoint(input);
  };
  const query = {
    scope,
    conversion: { ref: "purchase", identity: user, occurredAt: stamp(11) },
    definitions: [
      { id: "first", revision: 1 },
      { id: "last", revision: 1 },
    ],
    limit: 100,
  };
  return {
    store,
    service,
    states,
    authorize,
    options,
    record,
    query,
    setHour: (value: number) => {
      hour = value;
    },
  };
}

describe("acquisition URL boundary", () => {
  it("allowlists normalized campaign values and never returns query secrets, fragments or raw referrer paths", () => {
    const result = parseAcquisitionContext(
      {
        url: "https://shop.test/pricing?utm_source=%20NEWSLETTER%20&email=a%40b.test&token=secret#contact",
        referrer: "https://search.test/private?email=a@b.test#token",
        referrerAvailable: true,
      },
      urls,
    );
    expect(result).toEqual({
      landingRef: "pricing",
      campaign: { utm_source: "newsletter" },
      referrer: { status: "observed", origin: "https://search.test" },
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|contact|private|email|token|a@/);
    expect(
      parseAcquisitionContext(
        {
          url: "https://shop.test/?utm_source=newsletter&utm_source=forged",
          referrerAvailable: false,
        },
        urls,
      ),
    ).toEqual({ landingRef: "home", campaign: {}, referrer: { status: "unavailable" } });
  });
  it("keeps absent and unavailable separate and validates untrusted browser payloads", () => {
    expect(direct.referrer.status).toBe("absent");
    expect(
      parseAcquisitionContext(
        { url: "https://shop.test/", referrer: "invalid", referrerAvailable: true },
        urls,
      ).referrer.status,
    ).toBe("unavailable");
    expect(() =>
      validateAcquisitionContext({ ...context, campaign: { utm_source: "administrator" } }, urls),
    ).toThrow(AcquisitionProblem);
    expect(() =>
      validateAcquisitionContext(
        { ...context, referrer: { status: "absent", origin: "https://search.test" } },
        urls,
      ),
    ).toThrow(AcquisitionProblem);
  });
  it.each([
    "https://evil.test/",
    "https://user:secret@shop.test/",
    "https://shop.test/user@example.test",
  ])("rejects unregistered landing URLs without reflecting them: %s", (url) => {
    try {
      parseAcquisitionContext({ url, referrerAvailable: true }, urls);
      throw new Error("accepted");
    } catch (error) {
      expect(error).toMatchObject({ code: "analytics/acquisition/invalid" });
      expect(String(error)).not.toContain(url);
    }
  });
  it("redirects by registered reference only", () => {
    expect(resolveAcquisitionDestination("pricing", urls)).toBe("https://shop.test/pricing");
    for (const ref of ["https://evil.test", "//evil.test", "constructor", "__proto__"])
      expect(() => resolveAcquisitionDestination(ref, urls)).toThrow(AcquisitionProblem);
  });
});

describe("acquisition engine", () => {
  const conversion = { ref: "purchase", identity: anon, occurredAt: stamp(11) };
  const calculate = (rows: readonly AcquisitionTouchpoint[], def = definition) =>
    resolveAttribution({
      scope,
      conversion,
      definition: def,
      touchpoints: rows,
      knownAt: stamp(12),
    });
  it("selects the earliest campaign and includes subsequent direct visits in last-observed", () => {
    const rows = [point("campaign", 8), point("direct", 10, { context: direct })];
    expect(calculate(rows)).toMatchObject({
      status: "attributed",
      credit: 1,
      touchpointRefs: ["campaign"],
      coverage: "partial",
    });
    expect(calculate(rows, { ...definition, model: "last-observed-touch" })).toMatchObject({
      status: "unattributed",
      credit: 0,
      touchpointRefs: ["direct"],
      channel: "unknown",
    });
    expect(calculate([point("unattributed", 9, { context: direct })])).toMatchObject({
      channel: "unknown",
      credit: 0,
    });
  });
  it("includes exact window and conversion boundaries, excludes adjacent and future evidence, and breaks ties by stable ID", () => {
    const after = point("future", 12);
    const old = point("old", 7);
    const tie = [point("z", 8), point("a", 8), old, after, point("cutoff", 11)];
    expect(calculate(tie).touchpointRefs).toEqual(["a"]);
    expect(calculate([...tie].reverse()).touchpointRefs).toEqual(["a"]);
    expect(calculate(tie, { ...definition, model: "last-observed-touch" }).touchpointRefs).toEqual([
      "cutoff",
    ]);
    expect(calculate([old, after])).toMatchObject({ touchpointRefs: [], credit: 0 });
  });
  it("does not join another scope, person, expired observation or self-report", () => {
    const rows = [
      point("tenant", 8, { scope: { ...scope, tenantId: "two" } }),
      point("person", 8, { identity: user }),
      point("report", 8, { sourceKind: "self-reported", claim: "friend" }),
      point("expired", 8, { expiresAt: stamp(12) }),
    ];
    expect(calculate(rows).credit).toBe(0);
  });
});

describe("authorized acquisition service", () => {
  it("retains original anonymous provenance, links only the login snapshot, and never inherits later shared-browser visits", async () => {
    const f = fixture();
    await f.service.define(scope, definition);
    await f.service.define(scope, {
      ...definition,
      id: "last",
      model: "last-observed-touch",
      idempotencyKey: "last-1",
    });
    await f.record("ad", 8);
    await f.record("direct", 10, { context: direct });
    expect((await f.service.compare(f.query)).touchpoints).toEqual([]);
    const receipt = await f.service.linkKnownSubject({
      scope,
      id: "login",
      anonymousRef: anon.ref,
      subjectRef: user.ref,
      provenance: "authenticated-session",
    });
    expect(receipt.touchpointRefs).toEqual(["ad", "direct"]);
    const result = await f.service.compare(f.query);
    expect(result.results.map((row) => row.credit)).toEqual([1, 0]);
    expect(result.touchpoints[0].identity).toEqual(anon);
    expect(result.conversionCount).toBe(1);
    await f.record("after-login", 11);
    expect((await f.service.compare(f.query)).touchpoints.map((row) => row.id)).toEqual([
      "ad",
      "direct",
    ]);
    await expect(
      f.service.linkKnownSubject({
        scope,
        id: "other-login",
        anonymousRef: anon.ref,
        subjectRef: "user-b",
        provenance: "authenticated-session",
      }),
    ).rejects.toMatchObject({ code: "analytics/acquisition/conflict" });
    expect(
      (
        await f.service.compare({
          ...f.query,
          conversion: { ...f.query.conversion, identity: { kind: "subject", ref: "user-b" } },
        })
      ).touchpoints,
    ).toEqual([]);
  });
  it("deduplicates exact receipts and rejects conflicting touchpoints and definition revisions", async () => {
    const f = fixture();
    const accepted = await f.record("one", 8);
    expect(await f.record("one", 8)).toEqual(accepted);
    await expect(f.record("one", 9)).rejects.toMatchObject({
      code: "analytics/acquisition/conflict",
    });
    expect(await f.service.define(scope, definition)).toEqual(
      await f.service.define(scope, definition),
    );
    await expect(f.service.define(scope, { ...definition, windowMs: 99 })).rejects.toMatchObject({
      code: "analytics/acquisition/conflict",
    });
    await f.service.define(scope, {
      ...definition,
      revision: 2,
      idempotencyKey: "first-2",
      reason: "change-window",
      windowMs: 3600000,
    });
    expect(f.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ action: "define", actor: "operator", scope }),
    );
  });
  it("keeps conflicting self-reports separate, masks output and bounds reads without manufacturing attribution", async () => {
    const f = fixture();
    await f.service.define(scope, definition);
    await f.record("observed", 8, { identity: user });
    for (const [id, claim] of [
      ["response", "friend"],
      ["other-response", "podcast"],
    ] as const)
      await f.record(id, 9, {
        identity: user,
        sourceKind: "self-reported",
        claim,
        context: direct,
      });
    const query = { ...f.query, definitions: [{ id: "first", revision: 1 }] };
    const masked = new AcquisitionService(f.store, {
      ...f.options,
      policy: { authorize: f.authorize, mask: (row) => ({ ...row, context: direct }) },
    });
    const result = await masked.compare(query);
    expect(result.declarationStatus).toBe("conflict");
    expect(result.declarations).toHaveLength(2);
    expect(result.results[0].credit).toBe(1);
    expect(result.conversionCount).toBe(1);
    expect(result.touchpoints[0].context.campaign).toEqual({});
    await expect(f.service.compare({ ...query, limit: 2 })).rejects.toMatchObject({
      code: "analytics/acquisition/limit",
    });
    await expect(
      f.service.compare({ ...query, scope: { app: "shop", environment: "test" } } as never),
    ).rejects.toBeDefined();
  });
  it("deletes linked history and derived report references, prevents replay, and isolates tenants", async () => {
    const f = fixture();
    await f.service.define(scope, definition);
    await f.record("anonymous", 8);
    await f.service.linkKnownSubject({
      scope,
      id: "login",
      anonymousRef: anon.ref,
      subjectRef: user.ref,
      provenance: "login",
    });
    await f.service.compare({
      ...f.query,
      definitions: [{ id: "first", revision: 1 }],
      reportId: "report",
    });
    await f.service.deleteIdentity(scope, anon);
    const state = f.states.get(JSON.stringify(scope));
    expect(state?.touchpoints).toEqual([]);
    expect(state?.links).toEqual([]);
    expect(state?.reports).toEqual([]);
    await expect(f.record("anonymous", 8)).rejects.toMatchObject({
      code: "analytics/acquisition/deleted",
    });
    await expect(
      f.record("anonymous", 8, { scope: { ...scope, tenantId: "two" } }),
    ).resolves.toBeDefined();
  });
  it("enforces consent/identity policy for writes, links, reads and exports and surfaces store failure", async () => {
    const f = fixture();
    const denied = new AcquisitionService(f.store, {
      ...f.options,
      policy: {
        authorize() {
          throw new AcquisitionProblem("denied");
        },
        mask: (row) => row,
      },
    });
    await expect(denied.recordTouchpoint(point("id", 8))).rejects.toMatchObject({
      code: "analytics/acquisition/denied",
    });
    await expect(
      denied.linkKnownSubject({
        scope,
        id: "login",
        anonymousRef: anon.ref,
        subjectRef: user.ref,
        provenance: "forged",
      }),
    ).rejects.toMatchObject({ code: "analytics/acquisition/denied" });
    await expect(denied.compare(f.query)).rejects.toMatchObject({
      code: "analytics/acquisition/denied",
    });
    await expect(denied.compare({ ...f.query, reportId: "export" })).rejects.toMatchObject({
      code: "analytics/acquisition/denied",
    });
    const failing = new AcquisitionService(
      {
        async transact() {
          throw new AcquisitionProblem("persistence");
        },
      },
      f.options,
    );
    await expect(failing.compare(f.query)).rejects.toMatchObject({
      code: "analytics/acquisition/persistence",
    });
  });
  it("expires evidence at the boundary and purges links and derived reports consistently", async () => {
    const f = fixture();
    await f.service.define(scope, definition);
    await f.record("expired", 8, { identity: user });
    f.setHour(9); // next day is supplied explicitly by a second service clock
    const expired = new AcquisitionService(f.store, {
      ...f.options,
      clock: () => new Date("2026-10-18T08:00:00.000Z"),
    });
    const query = { ...f.query, definitions: [{ id: "first", revision: 1 }] };
    expect((await expired.compare(query)).results[0].credit).toBe(0);
    await expired.purgeExpired(scope);
    expect(f.states.get(JSON.stringify(scope))?.touchpoints).toEqual([]);
  });
});

it("persists only normalized contract fields, including for untrusted extra identity/scope properties", async () => {
  const f = fixture();
  await f.record("safe", 8, {
    identity: { ...user, token: "must-not-persist" },
    scope: { ...scope, email: "must-not-persist" },
  } as never);
  await f.service.define(scope, { ...definition, secret: "must-not-persist" } as never);
  expect(JSON.stringify([...f.states.values()])).not.toContain("must-not-persist");
});

it("checks expiry after acquiring a delayed store transaction, not before waiting for I/O", async () => {
  const f = fixture();
  await f.service.define(scope, definition);
  await f.record("recent", 8, { identity: user });
  let now = new Date(stamp(12));
  const delayed: AcquisitionStore = {
    async transact(scope, operation) {
      now = new Date("2026-10-18T08:00:00.000Z");
      return f.store.transact(scope, operation);
    },
  };
  const service = new AcquisitionService(delayed, { ...f.options, clock: () => now });
  expect(
    (await service.compare({ ...f.query, definitions: [{ id: "first", revision: 1 }] })).results[0]
      .credit,
  ).toBe(0);
  await expect(
    service.recordTouchpoint({ ...point("stale", 8), identity: user }),
  ).rejects.toMatchObject({ code: "analytics/acquisition/invalid" });
});

it.each(["constructor", "toString", "__proto__"])(
  "rejects inherited campaign keys with a stable Problem: %s",
  (key) => {
    const campaign = JSON.parse(`{"${key}":"newsletter"}`);
    expect(() => validateAcquisitionContext({ ...context, campaign }, urls)).toThrow(
      AcquisitionProblem,
    );
  },
);

it.each(["define", "delete", "purge"] as const)(
  "binds the authorized scope before awaiting policy for %s",
  async (action) => {
    const f = fixture();
    const otherScope = { ...scope, tenantId: "two" };
    await f.record("one", 8, { identity: user });
    await f.record("one", 8, { identity: user, scope: otherScope });
    let release: () => void = () => {};
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delayed = new AcquisitionService(f.store, {
      ...f.options,
      clock: () => new Date("2026-10-18T08:00:00.000Z"),
      policy: {
        authorize: async () => {
          await barrier;
        },
        mask: (row) => row,
      },
    });
    const mutableScope = { ...scope };
    const mutableIdentity = { ...user };
    const operation =
      action === "define"
        ? delayed.define(mutableScope, definition)
        : action === "delete"
          ? delayed.deleteIdentity(mutableScope, mutableIdentity)
          : delayed.purgeExpired(mutableScope);
    mutableScope.tenantId = "two";
    mutableIdentity.ref = "other-user";
    release();
    await operation;
    const authorized = f.states.get(JSON.stringify(scope));
    const other = f.states.get(JSON.stringify(otherScope));
    expect(other?.touchpoints.map((row) => row.id)).toEqual(["one"]);
    expect(other?.definitions).toEqual([]);
    if (action === "define") expect(authorized?.definitions[0].id).toBe("first");
    else expect(authorized?.touchpoints).toEqual([]);
  },
);

it("does not call a referral claim and a different self-report conflicting observations", async () => {
  const f = fixture();
  await f.service.define(scope, definition);
  await f.record("response", 9, {
    identity: user,
    sourceKind: "self-reported",
    claim: "friend",
    context: direct,
  });
  await f.record("referral", 9, {
    identity: user,
    sourceKind: "referral-claim",
    claim: "podcast",
    context: direct,
  });
  const report = await f.service.compare({
    ...f.query,
    definitions: [{ id: "first", revision: 1 }],
  });
  expect(report.declarationStatus).toBe("reported");
  expect(report.declarations.map((row) => row.sourceKind)).toEqual([
    "self-reported",
    "referral-claim",
  ]);
  expect(report.conversionCount).toBe(1);
  expect(report.results[0].credit).toBe(0);
});

it("does not silently reuse an exported report reference after new evidence arrives", async () => {
  const f = fixture();
  await f.service.define(scope, definition);
  await f.record("first", 8, { identity: user });
  const query = { ...f.query, definitions: [{ id: "first", revision: 1 }], reportId: "report" };
  const first = await f.service.compare(query);
  expect((await f.service.compare(query)).results).toEqual(first.results);
  await f.record("outside-window", 7, { identity: user });
  expect((await f.service.compare(query)).results).toEqual(first.results);
  await f.record("late-arrival", 9, { identity: user });
  await expect(f.service.compare(query)).rejects.toMatchObject({
    code: "analytics/acquisition/conflict",
  });
});

it("does not let runtime link extras replace server authorization claims", async () => {
  const f = fixture();
  await f.record("victim-visit", 8);
  const authorize = vi.fn((request) => {
    if (request.action === "link" && request.anonymousRef !== "owned-session")
      throw new AcquisitionProblem("denied");
  });
  const service = new AcquisitionService(f.store, {
    ...f.options,
    policy: { ...f.options.policy, authorize },
  });
  const forged = {
    scope,
    id: "forged-login",
    anonymousRef: anon.ref,
    subjectRef: user.ref,
    provenance: "login",
    action: "read",
    actor: "spoofed-actor",
    identity: { kind: "subject", ref: "spoofed-subject" },
  };
  await expect(service.linkKnownSubject(forged)).rejects.toMatchObject({
    code: "analytics/acquisition/denied",
  });
  expect(authorize).toHaveBeenCalledWith({
    action: "link",
    actor: "operator",
    scope,
    identity: user,
    anonymousRef: anon.ref,
    provenance: "login",
  });
  expect(f.states.get(JSON.stringify(scope))?.links).toEqual([]);
});

it("erases reports exported before anonymous history was linked to a deleted subject", async () => {
  const f = fixture();
  await f.service.define(scope, definition);
  await f.record("anonymous-visit", 8);
  await f.service.compare({
    ...f.query,
    conversion: { ...f.query.conversion, identity: anon },
    definitions: [{ id: "first", revision: 1 }],
    reportId: "anonymous-report",
  });
  await f.service.linkKnownSubject({
    scope,
    id: "login",
    anonymousRef: anon.ref,
    subjectRef: user.ref,
    provenance: "login",
  });
  await f.service.deleteIdentity(scope, user);
  const state = f.states.get(JSON.stringify(scope));
  expect(state?.touchpoints).toEqual([]);
  expect(state?.links).toEqual([]);
  expect(state?.reports).toEqual([]);
  expect(state?.deleted).toEqual(expect.arrayContaining([user, anon]));
});
