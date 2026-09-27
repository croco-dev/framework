import { describe, it } from "vitest";
import { c, defineFact } from "../index";
import type { ColumnKeyOfType, FactRow, RequiredColumnKey } from "../index";

const columns = {
  id: c.id(),
  maybeId: c.nullable(c.id()),
  happenedAt: c.instant({ precision: "millisecond" }),
  currency: c.currencyCode(),
  amount: c.moneyMinor({ currency: "currency" }),
} as const;

type Required = RequiredColumnKey<typeof columns>;
type Instants = ColumnKeyOfType<typeof columns, "instant">;

const validKey: Required = "id";
const validTime: Instants = "happenedAt";
// @ts-expect-error nullable grain keys are not permitted
const nullableKey: Required = "maybeId";
// @ts-expect-error event time must name an instant column
const wrongTime: Instants = "id";

const base = {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One event", key: ["id"] },
  columns,
  time: { event: "happenedAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
} as const;
const typed = defineFact("typed_capture", base);
type Row = FactRow<typeof typed>;

const missing = { ...base, grain: { description: "One event", key: ["absent"] } } as const;
const nullable = { ...base, grain: { description: "One event", key: ["maybeId"] } } as const;
const wrongEvent = { ...base, time: { event: "id" } } as const;
const wrongCurrency = {
  ...base,
  columns: { ...columns, amount: c.moneyMinor({ currency: "id" }) },
} as const;
const unsupportedKind = { ...base, kind: "periodic" } as const;
const unsupportedPrecision = {
  ...base,
  columns: { ...columns, happenedAt: { type: "instant", precision: "nano" } },
} as const;

function assertTypeContracts(): void {
  defineFact("valid", base);
  // @ts-expect-error missing grain key
  defineFact("bad", missing);
  // @ts-expect-error nullable grain key
  defineFact("bad", nullable);
  // @ts-expect-error wrong event time reference
  defineFact("bad", wrongEvent);
  // @ts-expect-error money currency reference must name a currency column
  defineFact("bad", wrongCurrency);
  // @ts-expect-error periodic facts are unsupported in v1
  defineFact("bad", unsupportedKind);
  // @ts-expect-error unsupported instant precision
  defineFact("bad", unsupportedPrecision);

  const validRow: Row = {
    id: "capture-1",
    maybeId: null,
    happenedAt: "2026-09-27T00:00:00.000Z",
    currency: "USD",
    amount: 100n,
  };
  const stringMoney: Row = { ...validRow, amount: "100" };
  // @ts-expect-error a required row field cannot be omitted
  const missingField: Row = {
    id: "capture-1",
    maybeId: null,
    happenedAt: "2026-09-27T00:00:00.000Z",
    currency: "USD",
  };
  const numericMoney: Row = {
    ...validRow,
    // @ts-expect-error money cannot use JavaScript number
    amount: 100,
  };
  const nullId: Row = {
    ...validRow,
    // @ts-expect-error required id cannot be null
    id: null,
  };
  void stringMoney;
  void missingField;
  void numericMoney;
  void nullId;
}

void assertTypeContracts;

describe("warehouse declaration types", () => {
  it("retains literal key and time types", () => {
    void validKey;
    void validTime;
    void nullableKey;
    void wrongTime;
  });
});
