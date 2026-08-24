import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryOnboardingStore } from "../libs/OnboardingStore";
import { OnboardingStateSnapshotUnsupportedProblem } from "../libs/problems/OnboardingProblems";
import type { OnboardingState } from "../libs/types";

const unsupportedSnapshotCases: ReadonlyArray<readonly [string, () => unknown]> = [
  ["function", () => () => "caller-owned"],
  ["shared-memory", () => new Uint8Array(new SharedArrayBuffer(1))],
  [
    "error-cause",
    () => {
      const error = new Error("metadata");
      Object.defineProperty(error, "cause", { value: new SharedArrayBuffer(1) });
      return error;
    },
  ],
  ["webassembly-memory", () => new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true })],
  [
    "hostile-proxy",
    () =>
      new Proxy(
        {},
        {
          getPrototypeOf: () => {
            throw new Error("raw proxy failure");
          },
        },
      ),
  ],
  [
    "array-shared-property",
    () =>
      Object.defineProperty([], "shared", {
        enumerable: true,
        value: new SharedArrayBuffer(1),
      }),
  ],
  [
    "accessor",
    () =>
      Object.defineProperty({}, "value", {
        enumerable: true,
        get: () => "caller-owned",
      }),
  ],
  [
    "hidden-accessor",
    () =>
      Object.defineProperty({}, "value", {
        get: () => "caller-owned",
      }),
  ],
  [
    "disguised-shared-memory",
    () => {
      const value = new SharedArrayBuffer(1);
      Object.setPrototypeOf(value, Object.prototype);
      return value;
    },
  ],
  [
    "disguised-webassembly-memory",
    () => {
      const value = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
      Object.setPrototypeOf(value, Object.prototype);
      return value;
    },
  ],
  [
    "custom-date",
    () => {
      class CustomDate extends Date {}
      return new CustomDate();
    },
  ],
  [
    "custom-array",
    () => {
      class CustomArray<T> extends Array<T> {}
      return new CustomArray();
    },
  ],
  [
    "custom-view",
    () => {
      class CustomBytes extends Uint8Array {}
      return new CustomBytes();
    },
  ],
  [
    "date-accessor",
    () =>
      Object.defineProperty(new Date(), "value", {
        get: () => "caller-owned",
      }),
  ],
  [
    "array-buffer-hidden-property",
    () => Object.defineProperty(new ArrayBuffer(1), "value", { value: "caller-owned" }),
  ],
  [
    "view-symbol-property",
    () =>
      Object.defineProperty(new Uint8Array(1), Symbol("value"), {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "date-enumerable-property",
    () =>
      Object.defineProperty(new Date(), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "array-buffer-enumerable-property",
    () =>
      Object.defineProperty(new ArrayBuffer(1), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "data-view-enumerable-property",
    () =>
      Object.defineProperty(new DataView(new ArrayBuffer(1)), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "typed-array-enumerable-property",
    () =>
      Object.defineProperty(new Uint8Array(1), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "forged-typed-array-prototype",
    () => {
      const value = new Uint8Array(1);
      Object.setPrototypeOf(value, Object.create(Object.getPrototypeOf(Uint8Array.prototype)));
      return value;
    },
  ],
];

describe("InMemoryOnboardingStore snapshot ownership", () => {
  beforeEach(() => {
    Container.reset();
  });

  it.each(unsupportedSnapshotCases)(
    "should reject %s metadata that cannot become an independent snapshot",
    async (onboardingId, createValue) => {
      const store = new InMemoryOnboardingStore();

      await expect(
        store.saveState("tenant-1", "user-1", onboardingId, {
          steps: {
            "step-1": {
              completed: false,
              metadata: { value: createValue() },
            },
          },
          isCompleted: false,
        }),
      ).rejects.toThrow(OnboardingStateSnapshotUnsupportedProblem);
      await expect(store.getState("tenant-1", "user-1", onboardingId)).resolves.toBeNull();
    },
  );

  it("should isolate supported binary metadata", async () => {
    const store = new InMemoryOnboardingStore();
    const ownedBytes = new Uint8Array([1, 2, 3]);
    await expect(
      store.saveState("tenant-1", "user-1", "supported-binary-metadata", {
        steps: {
          "step-1": {
            completed: false,
            metadata: { bytes: ownedBytes },
          },
        },
        isCompleted: false,
      }),
    ).resolves.toBeUndefined();
    ownedBytes[0] = 9;
    const binaryState = await store.getState("tenant-1", "user-1", "supported-binary-metadata");
    expect(binaryState?.steps["step-1"]?.metadata?.["bytes"]).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("should isolate saved state and loaded snapshots including nested metadata and dates", async () => {
    const store = new InMemoryOnboardingStore();
    const stepCompletedAt = new Date("2026-01-02T00:00:00.000Z");
    const onboardingCompletedAt = new Date("2026-01-03T00:00:00.000Z");
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const metadataUpdatedAt = new Date("2026-01-01T12:00:00.000Z");
    const metadata = {
      profile: { displayName: "Original", updatedAt: metadataUpdatedAt },
      flags: ["initial"],
    };
    const stepState = {
      completed: true,
      completedAt: stepCompletedAt,
      metadata,
    };
    const savedState: OnboardingState = {
      steps: { "step-1": stepState },
      isCompleted: true,
      completedAt: onboardingCompletedAt,
      status: "completed",
      startedAt,
      currentStepId: "step-1",
    };

    await store.saveState("tenant-1", "user-1", "welcome-tour", savedState);

    stepState.completed = false;
    stepCompletedAt.setUTCFullYear(2030);
    onboardingCompletedAt.setUTCFullYear(2030);
    startedAt.setUTCFullYear(2030);
    metadata.profile.displayName = "Mutated input";
    metadataUpdatedAt.setUTCFullYear(2030);
    metadata.flags.push("mutated-input");
    savedState.isCompleted = false;

    const loadedState = await store.getState("tenant-1", "user-1", "welcome-tour");
    expect(loadedState).toEqual({
      steps: {
        "step-1": {
          completed: true,
          completedAt: new Date("2026-01-02T00:00:00.000Z"),
          metadata: {
            profile: {
              displayName: "Original",
              updatedAt: new Date("2026-01-01T12:00:00.000Z"),
            },
            flags: ["initial"],
          },
        },
      },
      isCompleted: true,
      completedAt: new Date("2026-01-03T00:00:00.000Z"),
      status: "completed",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      currentStepId: "step-1",
    });

    if (!loadedState) {
      throw new Error("expected saved onboarding state");
    }
    const loadedStep = loadedState.steps["step-1"];
    if (!loadedStep) {
      throw new Error("expected saved onboarding step");
    }
    const loadedMetadata = loadedStep.metadata as typeof metadata;
    loadedStep.completed = false;
    loadedStep.completedAt?.setUTCFullYear(2040);
    loadedMetadata.profile.displayName = "Mutated output";
    loadedMetadata.profile.updatedAt.setUTCFullYear(2040);
    loadedMetadata.flags.push("mutated-output");
    loadedState.isCompleted = false;
    loadedState.completedAt?.setUTCFullYear(2040);
    loadedState.startedAt?.setUTCFullYear(2040);

    await expect(store.getState("tenant-1", "user-1", "welcome-tour")).resolves.toEqual({
      steps: {
        "step-1": {
          completed: true,
          completedAt: new Date("2026-01-02T00:00:00.000Z"),
          metadata: {
            profile: {
              displayName: "Original",
              updatedAt: new Date("2026-01-01T12:00:00.000Z"),
            },
            flags: ["initial"],
          },
        },
      },
      isCompleted: true,
      completedAt: new Date("2026-01-03T00:00:00.000Z"),
      status: "completed",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      currentStepId: "step-1",
    });
  });

  it("should isolate successful completion results and their completion timestamp", async () => {
    const store = new InMemoryOnboardingStore();
    const stepMetadata = { nested: { source: "stored" } };
    await store.saveState("tenant-1", "user-1", "welcome-tour", {
      steps: { "step-1": { completed: false, metadata: stepMetadata } },
      isCompleted: false,
    });
    const completedAt = new Date("2026-02-01T00:00:00.000Z");

    const result = await store.completeStep("tenant-1", "user-1", "welcome-tour", {
      stepId: "step-1",
      completedAt,
      requiredStepIds: ["step-1"],
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected successful onboarding step completion");
    }
    const resultStep = result.state.steps["step-1"];
    if (!resultStep) {
      throw new Error("expected completed onboarding step");
    }
    resultStep.completed = false;
    (resultStep.metadata as typeof stepMetadata).nested.source = "mutated result";
    resultStep.completedAt?.setUTCFullYear(2030);
    result.state.isCompleted = false;
    result.state.completedAt?.setUTCFullYear(2030);
    completedAt.setUTCFullYear(2040);

    await expect(store.getState("tenant-1", "user-1", "welcome-tour")).resolves.toEqual({
      steps: {
        "step-1": {
          completed: true,
          completedAt: new Date("2026-02-01T00:00:00.000Z"),
          metadata: { nested: { source: "stored" } },
        },
      },
      isCompleted: true,
      completedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
  });
});
