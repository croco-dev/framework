import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { InMemoryEventBus } from "@croco/events-inmemory";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductTrials, ProductTrialStore, TrialCommitted } from "../product/ProductTrials";
import { migrateProduct } from "../product/migrateProduct";
import type { DomainEvent } from "@croco/events-core";

const owner = { userId: "alice", tenantId: "team-a" };
const input = {
  commandId: "65d1c3c5-7f44-4f9c-921f-ab8fa5e04371",
  title: "Garden planner",
  audience: "Apartment gardeners",
};
const directories: string[] = [];
const databases: DatabaseSync[] = [];

function open(path: string) {
  const database = new DatabaseSync(path);
  databases.push(database);
  return database;
}

function fixture(observe: (event: DomainEvent) => void = () => {}) {
  const directory = mkdtempSync(join(tmpdir(), "croco-product-"));
  directories.push(directory);
  const path = join(directory, "product.sqlite");
  migrateProduct(path);
  const database = open(path);
  const bus = new InMemoryEventBus();
  class Observer {
    handle(event: DomainEvent) {
      observe(event);
    }
  }
  bus.subscribe({
    eventName: TrialCommitted.eventName,
    handlerClass: Observer,
    handler: new Observer(),
  });
  return { path, database, bus, store: new ProductTrialStore(database, bus) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const database of databases.splice(0)) database.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("private product trials", () => {
  it("persists a generated result and immutable fact before observing, surviving a reopened store", async () => {
    const observations: DomainEvent[] = [];
    const app = fixture((event) => {
      const observer = open(app.path);
      expect(observer.prepare("SELECT count(*) AS n FROM product_trial_facts").get()?.n).toBe(1);
      observations.push(event);
    });
    const result = await app.store.create(owner, input, "request-1");
    expect(result.observation).toBe("succeeded");
    expect(result.brief).toContain(input.title);
    expect(result.brief).toContain(input.audience);
    expect(observations.map((event) => event.eventId)).toEqual([result.eventId]);
    expect(
      app.database.prepare("SELECT correlation_id FROM product_trial_facts").get()?.correlation_id,
    ).toBe("request-1");
    expect(() => app.database.exec("DELETE FROM product_trial_facts")).toThrow("immutable");
    expect(() =>
      app.database.exec("UPDATE product_trial_facts SET correlation_id = 'changed'"),
    ).toThrow("immutable");
    app.database.close();
    databases.splice(databases.indexOf(app.database), 1);
    const reopened = new ProductTrialStore(open(app.path), app.bus);
    const { observation: _observation, ...stored } = result;
    expect(reopened.get(owner, result.id)).toEqual(stored);
  });

  it("deduplicates owner commands, rejects changed input and isolates tenant and user lookups", async () => {
    const observed: DomainEvent[] = [];
    const app = fixture((event) => {
      observed.push(event);
    });
    const first = await app.store.create(owner, input, "request-1");
    const duplicate = await app.store.create(owner, input, "request-2");
    expect(duplicate).toEqual({ ...first, observation: "not-repeated" });
    expect(observed).toHaveLength(1);
    await expect(
      app.store.create(owner, { ...input, title: "Changed" }, "request-3"),
    ).rejects.toMatchObject({ code: "TRIAL_COMMAND_CONFLICT" });
    for (const other of [
      { ...owner, userId: "bob" },
      { ...owner, tenantId: "team-b" },
    ]) {
      expect(() => app.store.get(other, first.id)).toThrow("Trial not found");
      expect((await app.store.create(other, input, "request-other")).id).not.toBe(first.id);
    }
  });

  it.each(["ABORT", "ROLLBACK"])(
    "preserves a %s failure without stored work or publishing",
    async (action) => {
      const observed: DomainEvent[] = [];
      const app = fixture((event) => {
        observed.push(event);
      });
      app.database.exec(
        `CREATE TRIGGER reject_fact BEFORE INSERT ON product_trial_facts BEGIN SELECT RAISE(${action}, 'fixture rejected fact'); END;`,
      );
      await expect(app.store.create(owner, input, "request-1")).rejects.toThrow(
        "fixture rejected fact",
      );
      expect(app.database.prepare("SELECT count(*) AS n FROM product_trials").get()?.n).toBe(0);
      expect(app.database.prepare("SELECT count(*) AS n FROM product_trial_facts").get()?.n).toBe(
        0,
      );
      expect(observed).toHaveLength(0);
    },
  );

  it("returns committed success with observation failure and does not repeat the command", async () => {
    const app = fixture(() => {
      throw new Error("observation unavailable");
    });
    const result = await app.store.create(owner, input, "request-1");
    expect(result.observation).toBe("failed");
    expect(app.store.get(owner, result.id).eventId).toBe(result.eventId);
    expect((await app.store.create(owner, input, "request-2")).observation).toBe("not-repeated");
    expect(app.database.prepare("SELECT count(*) AS n FROM product_trial_facts").get()?.n).toBe(1);
  });

  it("requires explicit migration and rejects invalid commands without stored work", async () => {
    expect(() => new ProductTrialStore(open(":memory:"), new InMemoryEventBus())).toThrow(
      "migrate",
    );
    const app = fixture();
    await expect(
      app.store.create(owner, { ...input, title: " " }, "request-1"),
    ).rejects.toMatchObject({ code: "TRIAL_INPUT_INVALID" });
    await expect(
      app.store.create({ ...owner, userId: "" }, input, "request-1"),
    ).rejects.toMatchObject({ code: "TRIAL_AUTH_REQUIRED" });
    expect(app.database.prepare("SELECT count(*) AS n FROM product_trials").get()?.n).toBe(0);
    migrateProduct(app.path);
  });
  it("serializes concurrent component commands and continues after a conflicting command", async () => {
    const app = fixture();
    vi.stubEnv("CROCO_PRODUCT_DATABASE", app.path);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const component = new ProductTrials();
    const commands = await Promise.allSettled([
      component.create(owner, input, "request-first"),
      component.create(owner, { ...input, title: `  ${input.title}  ` }, "request-duplicate"),
      component.create(owner, { ...input, audience: "Different audience" }, "request-conflict"),
      component.create(
        owner,
        { ...input, commandId: "d3a11fbf-9d93-4c94-843a-bd6858cb43c4" },
        "request-next",
      ),
    ]);
    expect(commands[0]).toMatchObject({ status: "fulfilled", value: { observation: "succeeded" } });
    expect(commands[1]).toMatchObject({
      status: "fulfilled",
      value: { observation: "not-repeated", correlationId: "request-first" },
    });
    expect(commands[2]).toMatchObject({
      status: "rejected",
      reason: { code: "TRIAL_COMMAND_CONFLICT" },
    });
    expect(commands[3]).toMatchObject({ status: "fulfilled", value: { observation: "succeeded" } });
    expect(app.database.prepare("SELECT count(*) AS n FROM product_trials").get()?.n).toBe(2);
    expect(app.database.prepare("SELECT count(*) AS n FROM product_trial_facts").get()?.n).toBe(2);
  });

  it("enforces the same UUID and trimmed input bounds at the domain boundary", async () => {
    const app = fixture();
    for (const invalid of [
      { ...input, commandId: "not-a-uuid" },
      { ...input, title: "x".repeat(101) },
      { ...input, audience: "x".repeat(161) },
      { ...input, audience: "  " },
    ]) {
      await expect(app.store.create(owner, invalid, "request-invalid")).rejects.toMatchObject({
        code: "TRIAL_INPUT_INVALID",
      });
    }
    const result = await app.store.create(
      owner,
      { ...input, title: ` ${input.title} `, audience: ` ${input.audience} ` },
      "request-valid",
    );
    expect(result).toMatchObject({ title: input.title, audience: input.audience });
  });

  it("preserves native storage and migration failures as Problem causes", async () => {
    const app = fixture();
    vi.stubEnv("CROCO_PRODUCT_DATABASE", app.path);
    app.database.exec("DROP TABLE product_trials");
    await expect(new ProductTrials().get(owner, "missing")).rejects.toMatchObject({
      code: "TRIAL_STORAGE_FAILED",
      cause: expect.any(Error),
    });
    expect(() => migrateProduct(join(app.path, "invalid.sqlite"))).toThrow(
      expect.objectContaining({ code: "TRIAL_MIGRATION_FAILED", cause: expect.any(Error) }),
    );
  });
});
