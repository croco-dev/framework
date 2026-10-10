import assert from "node:assert/strict";
import { createExample, request } from "./fixture";
async function main() {
  const operations = createExample();
  const state = await operations.read(request);
  assert.equal(state.kind, "ready");
  assert.ok("snapshot" in state);
  const currency = state.snapshot.byCurrency[0];
  assert.equal(currency?.arms[0]?.assignedUnits, 100);
  assert.equal(currency?.arms[0]?.netMinor, "80000");
  assert.equal(currency?.arms[1]?.netMinor, "74000");
  assert.deepEqual(currency?.delta[0]?.value, { numerator: "-60", denominator: "1" });
  assert.ok(!JSON.stringify(state).includes("unit-0"));
  assert.equal((await createExample("denied").read(request)).kind, "denied");
  const partial = await createExample("partial").read(request);
  assert.equal(partial.kind, "partial");
  assert.ok("snapshot" in partial);
  assert.equal(partial.snapshot.quality, "partial");
  assert.equal((await createExample("empty").read(request)).kind, "empty");
  await assert.rejects(createExample("error").read(request), /example failure/);
  const page = await operations.drilldown({
    ...request,
    arm: "treatment",
    currency: "USD",
    source: "ledger",
    limit: 2,
  });
  assert.equal(page.rows.length, 2);
  assert.equal(page.truncated, true);
  process.stdout.write(
    "Assigned outcomes: 100-person-per-arm golden, masking, denial, partial and bounded drilldown passed.\n",
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
