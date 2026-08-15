import { describe, expect, it } from "vitest";
import {
  InMemorySagaStore,
  SagaListPaginationProblem,
  type ListSagaExecutionsOptions,
} from "../index";

type PaginationField = "limit" | "offset";

const INVALID_PAGINATION_VALUES: ReadonlyArray<{
  readonly field: PaginationField;
  readonly value: number;
}> = [
  { field: "offset", value: -1 },
  { field: "offset", value: 0.5 },
  { field: "offset", value: Number.NaN },
  { field: "offset", value: Number.POSITIVE_INFINITY },
  { field: "offset", value: Number.NEGATIVE_INFINITY },
  { field: "limit", value: 0 },
  { field: "limit", value: -1 },
  { field: "limit", value: 0.5 },
  { field: "limit", value: Number.NaN },
  { field: "limit", value: Number.POSITIVE_INFINITY },
  { field: "limit", value: Number.NEGATIVE_INFINITY },
];

describe("InMemorySagaStore", () => {
  it.each(INVALID_PAGINATION_VALUES)(
    "rejects invalid $field value $value with a stable pagination Problem",
    async ({ field, value }) => {
      const store = new InMemorySagaStore();
      const options = { [field]: value } as ListSagaExecutionsOptions;

      await expect(store.list(options)).rejects.toMatchObject({
        code: "workflow-core/saga-list-pagination-invalid",
        extensions: {
          field,
          receivedValue: String(value),
          retryable: false,
        },
      });
      await expect(store.list(options)).rejects.toBeInstanceOf(SagaListPaginationProblem);
    },
  );

  it("keeps insertion ordering and applies valid offset and limit bounds", async () => {
    const store = new InMemorySagaStore();
    await store.create({ sagaName: "checkout", payload: "first" });
    await store.create({ sagaName: "checkout", payload: "second" });
    await store.create({ sagaName: "checkout", payload: "third" });

    await expect(store.list({ offset: 0, limit: 2 })).resolves.toMatchObject([
      { payload: "first" },
      { payload: "second" },
    ]);
    await expect(store.list({ offset: 1, limit: 2 })).resolves.toMatchObject([
      { payload: "second" },
      { payload: "third" },
    ]);
    await expect(store.list({ offset: 3, limit: 2 })).resolves.toEqual([]);
  });
});
