import { describe, expect, it } from "vitest";

/* oxlint-disable import/no-duplicates */
// @ts-expect-error EventOrdering was removed because Croco has no owning ordering runtime.
import type { EventOrdering as RemovedEventOrdering } from "../index";
// @ts-expect-error EventOrderingConfig was removed because its fields had no runtime consumer.
import type { EventOrderingConfig as RemovedEventOrderingConfig } from "../index";
// @ts-expect-error EventOrderingStrategy was coupled to the removed ordering configuration.
import type { EventOrderingStrategy as RemovedEventOrderingStrategy } from "../index";
// @ts-expect-error OrderedEventContext was coupled to the removed ordering contract.
import type { OrderedEventContext as RemovedOrderedEventContext } from "../index";
// @ts-expect-error OrderedEventHandler was coupled to the removed ordering contract.
import type { OrderedEventHandler as RemovedOrderedEventHandler } from "../index";
// @ts-expect-error OrderedEventResult was coupled to the removed ordering contract.
import type { OrderedEventResult as RemovedOrderedEventResult } from "../index";
// @ts-expect-error OrderingPolicy was coupled to the removed ordering configuration.
import type { OrderingPolicy as RemovedOrderingPolicy } from "../index";
// @ts-expect-error PartitionKeyExtractor was coupled to the removed ordering configuration.
import type { PartitionKeyExtractor as RemovedPartitionKeyExtractor } from "../index";
// @ts-expect-error PartitionStatus was coupled to the removed ordering contract.
import type { PartitionStatus as RemovedPartitionStatus } from "../index";
// @ts-expect-error EventReplay was removed because Croco has no owning replay runtime.
import type { EventReplay as RemovedEventReplay } from "../index";
// @ts-expect-error EventSnapshot was coupled to the removed replay contract.
import type { EventSnapshot as RemovedEventSnapshot } from "../index";
// @ts-expect-error EventStore was coupled to the removed replay contract.
import type { EventStore as RemovedEventStore } from "../index";
// @ts-expect-error ReplayMode was coupled to the removed replay configuration.
import type { ReplayMode as RemovedReplayMode } from "../index";
// @ts-expect-error ReplayOptions was removed because its fields had no runtime consumer.
import type { ReplayOptions as RemovedReplayOptions } from "../index";
// @ts-expect-error ReplayResult was coupled to the removed replay contract.
import type { ReplayResult as RemovedReplayResult } from "../index";
/* oxlint-enable import/no-duplicates */

type RemovedEventContracts = [
  RemovedEventOrdering,
  RemovedEventOrderingConfig,
  RemovedEventOrderingStrategy,
  RemovedOrderedEventContext,
  RemovedOrderedEventHandler,
  RemovedOrderedEventResult,
  RemovedOrderingPolicy,
  RemovedPartitionKeyExtractor,
  RemovedPartitionStatus,
  RemovedEventReplay,
  RemovedEventSnapshot,
  RemovedEventStore,
  RemovedReplayMode,
  RemovedReplayOptions,
  RemovedReplayResult,
];

const removedEventContracts: RemovedEventContracts | undefined = undefined;

describe("events-core public contracts", () => {
  it("keeps unsupported ordering and replay type families absent", () => {
    expect(removedEventContracts).toBeUndefined();
  });
});
