import { assertReminderSchedule, ReminderInvalidProblem } from "./ReminderContracts";
import type { ReminderSchedule } from "./ReminderContracts";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Strictly after referenceTime; gaps advance to the first valid minute, folds use the first instant only. */
export function nextOccurrence(
  schedule: ReminderSchedule,
  timezone: string,
  referenceTime: Date,
): Date {
  assertReminderSchedule(schedule, timezone);
  if (!(referenceTime instanceof Date) || !Number.isFinite(referenceTime.getTime()))
    throw new ReminderInvalidProblem("Reference time must be a valid Date");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const wall = (instant: number): number => {
    const parts = formatter.formatToParts(instant);
    const value = (name: string) => Number(parts.find((part) => part.type === name)?.value);
    return Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
    );
  };
  const localDay = Math.floor(wall(referenceTime.getTime()) / DAY) * DAY;
  const [hour, minute] = schedule.localTime.split(":").map(Number);
  for (let day = 0; day <= 8; day++) {
    const date = localDay + day * DAY;
    if (!schedule.weekdays.includes(new Date(date).getUTCDay())) continue;
    const target = date + (hour * 60 + minute) * MINUTE;
    const offsets = new Set<number>();
    for (let sample = target - 2 * DAY; sample <= target + 2 * DAY; sample += 6 * 60 * MINUTE)
      offsets.add(wall(sample) - sample);
    const candidates = [...offsets].map((offset) => target - offset).sort((a, b) => a - b);
    let instant = candidates.find((candidate) => wall(candidate) === target);
    if (instant === undefined) {
      // An absent civil minute: find the transition's first valid minute, including a skipped date.
      const start = Math.min(...candidates) - DAY;
      const end = Math.max(...candidates) + DAY;
      for (let candidate = start; candidate <= end; candidate += MINUTE) {
        if (wall(candidate) >= target) {
          instant = candidate;
          break;
        }
      }
    }
    if (instant !== undefined && instant > referenceTime.getTime()) return new Date(instant);
  }
  throw new ReminderInvalidProblem(
    "No next weekly occurrence can be resolved for this reference time",
  );
}
