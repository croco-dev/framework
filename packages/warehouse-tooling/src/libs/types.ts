import type { PgTable } from "drizzle-orm/pg-core";
import type { FactDeclaration } from "@croco/warehouse-core";
import type { PipelineDefinition } from "@croco/etl-core/pipeline";

export type SourceLocation = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
};
export type ConnectionRef = { readonly id: string; readonly env: string };
export type OltpSourceRef = {
  readonly id: string;
  readonly table: PgTable;
  readonly connection: string;
  readonly columns: Readonly<Record<string, string>>;
  readonly location: SourceLocation;
};
export type ModelBinding = {
  readonly fact: FactDeclaration;
  readonly connection: string;
  readonly location: SourceLocation;
} & (
  | { readonly backend: "postgres" }
  | { readonly backend: "external"; readonly schema: string; readonly table: string }
);
export type DataOverlay = {
  readonly connections?: Readonly<Record<string, { readonly env: string }>>;
  readonly budgets?: Readonly<Record<string, number>>;
};
export type DataConfig = {
  readonly connections: readonly ConnectionRef[];
  readonly sources: readonly OltpSourceRef[];
  readonly models: readonly ModelBinding[];
  readonly pipelines: readonly {
    readonly definition: PipelineDefinition;
    readonly location: SourceLocation;
  }[];
  readonly overlays?: Readonly<Record<string, DataOverlay>>;
};
export type DataNode = {
  readonly id: string;
  readonly kind: "source" | "model" | "pipeline" | "metadata";
  readonly version: number;
  readonly semanticHash: string;
  readonly documentationHash: string;
  readonly physicalHash: string;
  readonly location: SourceLocation;
  readonly dependencies: readonly string[];
  readonly definition: Readonly<Record<string, unknown>>;
};
export type DataManifest = {
  readonly formatVersion: 1;
  readonly compilerVersion: "1";
  readonly providerVersion: "postgres-facts-v1";
  readonly nodes: readonly DataNode[];
  readonly order: readonly string[];
  readonly connections: readonly ConnectionRef[];
  readonly budgets: Readonly<Record<string, number>>;
  readonly artifacts: Readonly<Record<string, string>>;
};
export type CompiledDataConfig = {
  readonly manifest: DataManifest;
  readonly files: Readonly<Record<string, string>>;
};
