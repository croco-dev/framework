import { describe, it } from "vitest";
import {
  createTransactionalOutboxStoreContractSuite,
  InMemoryTransactionalOutboxStore,
} from "../index";

describe("TransactionalOutboxStore contract", () => {
  const suite = createTransactionalOutboxStoreContractSuite({
    createStore: () => new InMemoryTransactionalOutboxStore(),
    listRecords: (store) => store.listRecords(),
    runInUnitOfWork: (store, fn) => store.runInUnitOfWork(fn),
  });

  it.each(suite.cases)("$name", async (testCase) => {
    await testCase.run();
  });
});
