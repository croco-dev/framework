import type { PgTable } from "drizzle-orm/pg-core";
import type { FactDeclaration } from "@croco/warehouse-core";
import type { ConnectionRef, DataConfig, ModelBinding, OltpSourceRef } from "./types";

export function connectionRef(id: string, options: { readonly env: string }): ConnectionRef {
  return Object.freeze({ id, ...options });
}
export function oltpSourceRef<T extends PgTable>(
  id: string,
  table: T,
  options: Omit<OltpSourceRef, "id" | "table" | "columns"> & {
    readonly columns: Readonly<Record<string, keyof T["_"]["columns"] & string>>;
  },
): OltpSourceRef {
  return Object.freeze({ id, table, ...options });
}
export function postgresModel(
  fact: FactDeclaration,
  options: Omit<Extract<ModelBinding, { backend: "postgres" }>, "backend" | "fact">,
): ModelBinding {
  return Object.freeze({ backend: "postgres", fact, ...options });
}
export function externalModel(
  fact: FactDeclaration,
  options: Omit<Extract<ModelBinding, { backend: "external" }>, "backend" | "fact">,
): ModelBinding {
  return Object.freeze({ backend: "external", fact, ...options });
}
export function defineDataConfig<const T extends DataConfig>(config: T): T {
  return config;
}
