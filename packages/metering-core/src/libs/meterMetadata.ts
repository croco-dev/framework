import { InvalidMeterMetadataProblem } from "./problems/InvalidMeterMetadataProblem";
import type { MeterDefinitionMetadata } from "./types";

type MetadataVisit =
  | { kind: "visit"; value: unknown; path: string }
  | { kind: "leave"; value: object };

/** Validate and copy JSON/Date meter definition metadata without executing accessors. */
export function snapshotMeterMetadata(
  metadata: unknown,
  meter: { tenantId: string; meterId: string },
): MeterDefinitionMetadata {
  try {
    function fail(path: string, reason: string): never {
      throw new InvalidMeterMetadataProblem(meter, path, reason);
    }
    const validateData = (data: unknown): void => {
      const isPlainObject = (value: object): boolean => {
        const prototype: unknown = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
      };
      if (data === null || typeof data !== "object" || !isPlainObject(data)) {
        fail("/metadata", "metadata must be a plain object");
      }
      const active = new WeakSet<object>();
      const complete = new WeakSet<object>();
      const pending: MetadataVisit[] = [{ kind: "visit", value: data, path: "/metadata" }];
      while (pending.length > 0) {
        const visit = pending.pop();
        if (!visit) break;
        if (visit.kind === "leave") {
          active.delete(visit.value);
          complete.add(visit.value);
          continue;
        }
        const { value, path } = visit;
        if (value === null || typeof value === "string" || typeof value === "boolean") continue;
        if (typeof value === "number" && Number.isFinite(value)) continue;
        if (typeof value !== "object") fail(path, "values must be JSON data or valid Date values");
        const array = Array.isArray(value);
        let timestamp: number | undefined;
        try {
          // Check the internal Date brand even when callers replace its prototype.
          timestamp = Date.prototype.getTime.call(value);
        } catch {
          timestamp = undefined;
        }
        if (timestamp !== undefined) {
          if (!Number.isFinite(timestamp) || Reflect.ownKeys(value).length !== 0) {
            fail(path, "Date values must be valid and have no custom properties");
          }
          continue;
        }
        if (!array && !isPlainObject(value)) {
          fail(path, "objects must be plain objects, arrays or Date values");
        }
        if (active.has(value)) fail(path, "cyclic metadata is not supported");
        if (complete.has(value)) continue;
        const keys = Reflect.ownKeys(value);
        if (array && keys.length - 1 !== value.length)
          fail(path, "arrays must be dense and have no custom properties");
        active.add(value);
        pending.push({ kind: "leave", value });
        for (const key of keys) {
          if (array && key === "length") continue;
          if (typeof key !== "string") fail(path, "symbol keys are not supported");
          const childPath = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
          if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) {
            fail(childPath, "arrays must have only indexed entries");
          }
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
            fail(childPath, "properties must be enumerable data properties");
          }
          pending.push({ kind: "visit", value: descriptor.value, path: childPath });
        }
      }
    };
    validateData(metadata);
    const snapshot = structuredClone(metadata);
    // Native copying reveals built-in brands even when an input has a plain-looking prototype.
    validateData(snapshot);
    return snapshot as MeterDefinitionMetadata;
  } catch (error) {
    if (error instanceof InvalidMeterMetadataProblem) throw error;
    throw new InvalidMeterMetadataProblem(
      meter,
      "/metadata",
      "metadata cannot be inspected or copied as JSON and Date data",
    );
  }
}
