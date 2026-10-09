import { Problem, ProblemCategory } from "@croco/problems-core";
import type { MissionDefinition, MissionScope } from "./types";

export class MissionInvalidProblem extends Problem {
  readonly code = "gamification/invalid";
  readonly category = ProblemCategory.ValidationError;
  constructor(reason: string) {
    super(undefined, undefined, reason);
  }
}
export class MissionConflictProblem extends Problem {
  readonly code = "gamification/conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(reason: string) {
    super(undefined, undefined, reason);
  }
}
export class MissionAccessDeniedProblem extends Problem {
  readonly code = "gamification/access-denied";
  readonly category = ProblemCategory.Forbidden;
  constructor() {
    super(undefined, undefined, "Mission access denied");
  }
}
export class MissionNotFoundProblem extends Problem {
  readonly code = "gamification/not-found";
  readonly category = ProblemCategory.NotFound;
  constructor() {
    super(undefined, undefined, "Published mission version not found");
  }
}
export function missionText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200)
    throw new MissionInvalidProblem(`Invalid ${field}`);
}
export function assertMissionScope(scope: MissionScope): void {
  if (!scope) throw new MissionInvalidProblem("Scope required");
  for (const field of ["appId", "environmentId", "tenantId"] as const)
    missionText(scope[field], field);
}
export function missionInstant(value: string): number {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new MissionInvalidProblem("Expected UTC timestamp");
  if (new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19))
    throw new MissionInvalidProblem("Invalid calendar timestamp");
  return Date.parse(value);
}
export function missionDate(value: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new MissionInvalidProblem("Expected calendar date");
  const result = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== value)
    throw new MissionInvalidProblem("Invalid calendar date");
  return result;
}
export function validateMissionDefinition(definition: MissionDefinition): void {
  if (!definition) throw new MissionInvalidProblem("Definition required");
  missionText(definition.id, "id");
  missionText(definition.actionId, "actionId");
  if (
    !Number.isSafeInteger(definition.version) ||
    definition.version < 1 ||
    definition.version > 2147483647
  )
    throw new MissionInvalidProblem("Invalid version");
  if (!["events", "distinct-days", "streak"].includes(definition.countMode))
    throw new MissionInvalidProblem("Invalid count mode");
  if (definition.unit !== (definition.countMode === "events" ? "event" : "day"))
    throw new MissionInvalidProblem("Unit must match count mode");
  if (!["day", "week"].includes(definition.period))
    throw new MissionInvalidProblem("Invalid period");
  missionDate(definition.anchor);
  try {
    new Intl.DateTimeFormat("en", { timeZone: definition.timezone }).format();
  } catch {
    throw new MissionInvalidProblem("Invalid timezone");
  }
  missionText(definition.timezone, "timezone");
  if (
    !Number.isSafeInteger(definition.target) ||
    definition.target < 1 ||
    !Number.isSafeInteger(definition.perPeriodCap) ||
    definition.perPeriodCap < definition.target ||
    definition.perPeriodCap > 10000
  )
    throw new MissionInvalidProblem("Invalid target/cap");
  if (
    definition.countMode !== "events" &&
    definition.perPeriodCap > (definition.period === "day" ? 1 : 7)
  )
    throw new MissionInvalidProblem("Day cap exceeds period");
  if (
    !Number.isSafeInteger(definition.lateAcceptanceMs) ||
    definition.lateAcceptanceMs < 0 ||
    definition.lateAcceptanceMs > 31 * 86400000
  )
    throw new MissionInvalidProblem("Invalid lateness allowance");
  if (!["reject", "record-only", "recalculate"].includes(definition.closedCorrection))
    throw new MissionInvalidProblem("Invalid closed correction policy");
}
export function missionLocalDate(instant: string, timezone: string): string {
  missionInstant(instant);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}
export function missionPeriod(
  definition: MissionDefinition,
  activityDate: string,
): { startDate: string; endDate: string; periodKey: string } {
  const day = missionDate(activityDate);
  const anchor = missionDate(definition.anchor);
  if (day < anchor) throw new MissionInvalidProblem("Activity predates mission anchor");
  const length = definition.period === "day" ? 1 : 7;
  const start = anchor + Math.floor((day - anchor) / (length * 86400000)) * length * 86400000;
  const startDate = new Date(start).toISOString().slice(0, 10);
  return {
    startDate,
    endDate: new Date(start + length * 86400000).toISOString().slice(0, 10),
    periodKey: startDate,
  };
}
/** Find the first instant of a local date, including timezone transitions at midnight. */
export function missionDateStart(date: string, timezone: string): number {
  const center = missionDate(date);
  let low = center - 36 * 3600000;
  let high = center + 36 * 3600000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (missionLocalDate(new Date(mid).toISOString(), timezone) < date) low = mid + 1;
    else high = mid;
  }
  return low;
}
export function missionKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(missionKey).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${missionKey(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
