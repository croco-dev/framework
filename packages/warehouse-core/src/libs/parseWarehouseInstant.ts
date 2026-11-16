/** Parses calendar and offset components without rounding fractional seconds. */
export function parseWarehouseInstant(
  value: unknown,
):
  | { readonly epochSeconds: number; readonly fraction: string; readonly offset: string }
  | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(
    value,
  );
  if (!match) return undefined;
  const [, localTime, fraction = "", offset] = match;

  // Check the local calendar before the offset can shift the date.
  const utcMilliseconds = Date.parse(`${localTime}Z`);
  if (
    !Number.isFinite(utcMilliseconds) ||
    new Date(utcMilliseconds).toISOString() !== `${localTime}.000Z`
  )
    return undefined;

  let offsetMinutes = 0;
  if (offset !== "Z") {
    const hours = Number(offset.slice(1, 3));
    const minutes = Number(offset.slice(4, 6));
    if (hours >= 24 || minutes >= 60) return undefined;
    offsetMinutes = (hours * 60 + minutes) * (offset.startsWith("-") ? -1 : 1);
  }
  return { epochSeconds: utcMilliseconds / 1000 - offsetMinutes * 60, fraction, offset };
}
