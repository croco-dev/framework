import { describe, expect, it } from "vitest";

type AtomicFixture<Tx> = {
  transact<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
  writes: readonly ((tx: Tx) => Promise<unknown>)[];
  read(tx?: Tx): Promise<unknown>;
  mutateCopies(tx: Tx): Promise<void>;
};

function barrier(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** The same atomicity oracle for both process-local stores. */
export function atomicStoreConformance<Tx>(
  name: string,
  writeNames: readonly string[],
  create: () => Promise<AtomicFixture<Tx>>,
): void {
  describe(`${name} atomic conformance`, () => {
    it.each(writeNames.map((name, index) => ({ name, index })))(
      "discards every change after $name rejects",
      async ({ index }) => {
        const fixture = await create();
        const before = await fixture.read();
        const failure = new Error("injected callback failure");
        await expect(
          fixture.transact(async (tx) => {
            for (const write of fixture.writes.slice(0, index + 1)) await write(tx);
            throw failure;
          }),
        ).rejects.toBe(failure);
        expect(await fixture.read()).toEqual(before);
        // The queue recovers and the same keys/fingerprints remain available.
        await fixture.transact(async (tx) => {
          for (const write of fixture.writes) await write(tx);
        });
        expect(await fixture.read()).not.toEqual(before);
      },
    );

    it("publishes successful work together and preserves the callback result", async () => {
      const fixture = await create();
      const before = await fixture.read();
      let staged: unknown;
      const receipt = { id: "callback-result" };
      expect(
        await fixture.transact(async (tx) => {
          for (const write of fixture.writes) await write(tx);
          staged = await fixture.read(tx);
          expect(staged).not.toEqual(before);
          expect(await fixture.read()).toEqual(before);
          return receipt;
        }),
      ).toBe(receipt);
      expect(await fixture.read()).toEqual(staged);
    });

    it("isolates nested objects returned by reads and discards failed writes", async () => {
      const fixture = await create();
      const before = await fixture.read();
      await expect(
        fixture.transact(async (tx) => {
          await fixture.mutateCopies(tx);
          for (const write of fixture.writes) await write(tx);
          throw new Error("abort after nested mutations");
        }),
      ).rejects.toThrow("abort after nested mutations");
      expect(await fixture.read()).toEqual(before);
      await fixture.transact(async (tx) => {
        await fixture.mutateCopies(tx);
      });
      expect(await fixture.read()).toEqual(before);
    });

    it("serializes a queued writer after an aborted transaction without exposing staged state", async () => {
      const fixture = await create();
      const before = await fixture.read();
      const entered = barrier();
      const release = barrier();
      let staged: unknown;
      const first = fixture.transact(async (tx) => {
        for (const write of fixture.writes) await write(tx);
        staged = await fixture.read(tx);
        entered.resolve();
        await release.promise;
        throw new Error("abort first writer");
      });
      const firstResult = first.catch((error: unknown) => error);
      await entered.promise;
      let secondEntered = false;
      const second = fixture.transact(async (tx) => {
        secondEntered = true;
        expect(await fixture.read(tx)).toEqual(before);
        for (const write of fixture.writes) await write(tx);
      });
      const secondResult = second.catch((error: unknown) => error);
      let visible: unknown;
      let wasEntered: boolean;
      try {
        visible = await fixture.read();
        wasEntered = secondEntered;
      } finally {
        release.resolve();
      }
      expect(await firstResult).toEqual(new Error("abort first writer"));
      const secondError = await secondResult;
      expect(visible).toEqual(before);
      expect(wasEntered).toBe(false);
      expect(secondError).toBeUndefined();
      expect(await fixture.read()).toEqual(staged);
    });

    it("detaches a retained transaction handle after commit and rollback", async () => {
      const fixture = await create();
      const committed = await fixture.transact(async (tx) => tx);
      const before = await fixture.read();
      for (const write of fixture.writes) await write(committed);
      expect(await fixture.read()).toEqual(before);
      const captured: Tx[] = [];
      await expect(
        fixture.transact(async (tx) => {
          captured.push(tx);
          throw new Error("abort retained handle");
        }),
      ).rejects.toThrow("abort retained handle");
      for (const tx of captured) for (const write of fixture.writes) await write(tx);
      expect(await fixture.read()).toEqual(before);
    });
  });
}
