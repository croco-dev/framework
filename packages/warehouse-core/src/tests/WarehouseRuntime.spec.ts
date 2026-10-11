import { describe, expectTypeOf, it } from "vitest";
import type {
  CatalogStore,
  WarehouseAccess,
  WarehouseCandidate,
  WarehousePage,
  WarehouseReadRequest,
  WarehouseReader,
  WarehouseSnapshot,
  WarehouseWriter,
  WriteReceipt,
} from "../runtime";
import type { CanonicalRow } from "../index";

function assertImmutableContracts(
  candidate: WarehouseCandidate,
  snapshot: WarehouseSnapshot,
  access: WarehouseAccess,
  page: WarehousePage,
): void {
  // @ts-expect-error candidate fencing cannot be mutated by a consumer
  candidate.fence = 2;
  // @ts-expect-error published segment membership is immutable
  snapshot.segmentRefs.push("new-segment");
  // @ts-expect-error callers cannot grant themselves roles on resolved access
  access.roles.push("publish");
  // @ts-expect-error query results retain immutable canonical rows
  page.rows[0].id = "replacement";
  // @ts-expect-error freshness is independent from temporal completeness
  snapshot.quality.temporalCompleteness = "fresh";
}
void assertImmutableContracts;

describe("warehouse runtime contracts", () => {
  it("preserves canonical rows and requires a pinned bounded query", () => {
    expectTypeOf<WarehouseReadRequest["snapshotId"]>().toEqualTypeOf<string>();
    expectTypeOf<WarehouseReadRequest["maxRows"]>().toEqualTypeOf<number>();
    expectTypeOf<WarehouseReadRequest["maxBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<WarehouseReadRequest["timeoutMs"]>().toEqualTypeOf<number>();
    expectTypeOf<WarehousePage["rows"]>().toEqualTypeOf<readonly CanonicalRow[]>();
    expectTypeOf<WarehousePage["exactness"]>().toEqualTypeOf<"exact">();
  });

  it("distinguishes missing receipts from indeterminate outcomes", () => {
    expectTypeOf<ReturnType<WarehouseWriter["reconcileReceipt"]>>().toEqualTypeOf<
      Promise<WriteReceipt | null>
    >();
    expectTypeOf<WriteReceipt["state"]>().toEqualTypeOf<"durable" | "indeterminate" | "rejected">();
    expectTypeOf<ReturnType<CatalogStore["publishCandidate"]>>().toEqualTypeOf<
      Promise<WarehouseSnapshot>
    >();
    expectTypeOf<ReturnType<WarehouseReader["read"]>>().toEqualTypeOf<Promise<WarehousePage>>();
  });
});
