import { describe, expect, it } from "vitest";
import { nextOccurrence } from "../libs/nextOccurrence";
import { ReminderInvalidProblem } from "../libs/ReminderContracts";

describe("nextOccurrence", () => {
  it("resolves Seoul Monday at 09:00 independently of the host timezone", () => {
    expect(
      nextOccurrence(
        { localTime: "09:00", weekdays: [1] },
        "Asia/Seoul",
        new Date("2026-10-04T23:59:59Z"),
      ).toISOString(),
    ).toBe("2026-10-05T00:00:00.000Z");
  });
  it("uses strict reference time and does not mutate inputs", () => {
    const reference = new Date("2026-10-05T00:00:00Z");
    expect(
      nextOccurrence({ localTime: "09:00", weekdays: [1] }, "Asia/Seoul", reference).toISOString(),
    ).toBe("2026-10-12T00:00:00.000Z");
    expect(reference.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("advances DST gaps to the first valid minute", () => {
    expect(
      nextOccurrence(
        { localTime: "02:30", weekdays: [0] },
        "America/New_York",
        new Date("2026-03-08T00:00:00Z"),
      ).toISOString(),
    ).toBe("2026-03-08T07:00:00.000Z");
  });
  it("uses the first fold occurrence once, even when reference is between folds", () => {
    const schedule = { localTime: "01:30", weekdays: [0] };
    expect(
      nextOccurrence(schedule, "America/New_York", new Date("2026-11-01T00:00:00Z")).toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
    expect(
      nextOccurrence(schedule, "America/New_York", new Date("2026-11-01T05:45:00Z")).toISOString(),
    ).toBe("2026-11-08T06:30:00.000Z");
  });
  it("handles a half-hour DST gap", () => {
    expect(
      nextOccurrence(
        { localTime: "02:15", weekdays: [0] },
        "Australia/Lord_Howe",
        new Date("2026-10-03T00:00:00Z"),
      ).toISOString(),
    ).toBe("2026-10-03T15:30:00.000Z");
  });
  it("rejects malformed timezone, dates and schedules with a stable Problem", () => {
    for (const zone of ["Invalid/Zone", "+09:00", ""])
      expect(() => nextOccurrence({ localTime: "09:00", weekdays: [1] }, zone, new Date())).toThrow(
        ReminderInvalidProblem,
      );
    for (const localTime of ["25:00", "9:00", "09:60"])
      expect(() => nextOccurrence({ localTime, weekdays: [1] }, "UTC", new Date())).toThrow(
        ReminderInvalidProblem,
      );
    for (const weekdays of [[], [1, 1], [7], [0.5]])
      expect(() => nextOccurrence({ localTime: "09:00", weekdays }, "UTC", new Date())).toThrow(
        ReminderInvalidProblem,
      );
    expect(() =>
      nextOccurrence({ localTime: "09:00", weekdays: [1] }, "UTC", new Date("bad")),
    ).toThrow(ReminderInvalidProblem);
  });
});
