import type { CreditAccountId } from "@croco/credits-core";
import { describe, expect, it } from "vitest";
import {
  createCreditsSchema,
  CreditLedgerPersistenceProblem,
  type DrizzleCreditClient,
  DrizzleCreditLedgerStore,
  type DrizzleCreditTxManager,
} from "../index";

describe("DrizzleCreditLedgerStore", () => {
  it("redacts driver details from read failures", async () => {
    const driverDetail = "driver detail: internal ledger table name";
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.reject(new Error(driverDetail)),
          }),
        }),
      }),
    } as unknown as DrizzleCreditClient;
    const txManager = {
      getClient: () => null,
      run: async <T>(operation: () => Promise<T>) => operation(),
    } satisfies DrizzleCreditTxManager;
    const store = new DrizzleCreditLedgerStore(db, txManager);

    const failure = await store
      .getAccount("account-redaction" as CreditAccountId)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CreditLedgerPersistenceProblem);
    expect((failure as CreditLedgerPersistenceProblem).detail).not.toContain(driverDetail);
  });

  it("redacts driver details from migration failures", async () => {
    const driverDetail = "migration driver detail: internal schema name";
    const failure = await createCreditsSchema({
      execute: () => Promise.reject(new Error(driverDetail)),
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CreditLedgerPersistenceProblem);
    expect((failure as CreditLedgerPersistenceProblem).detail).not.toContain(driverDetail);
  });
});
