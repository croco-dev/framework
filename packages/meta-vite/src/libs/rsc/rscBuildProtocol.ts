import type { HeadMetadata } from "../routes/head";
import type { RuntimeContext } from "../render/types";

/** Messages between the host and the worker that owns one RSC build. */

export type RscWorkerData = {
  readonly serverFile: string;
  readonly ssrFile: string;
  readonly serverEntryVersion: string;
  readonly ssrEntryVersion: string;
};

export type RscSerializedRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: readonly (readonly [string, string])[];
};

export type RscSerializedError = {
  readonly message: string;
  readonly name?: string;
  readonly code?: string;
};

export type RscRenderMode = "flight" | "document";

export type RscHostMessage =
  | {
      readonly type: "render";
      readonly id: number;
      readonly mode: RscRenderMode;
      readonly route: string;
      readonly request: RscSerializedRequest;
      readonly context?: RuntimeContext;
    }
  | { readonly type: "pull"; readonly id: number }
  | { readonly type: "cancel"; readonly id: number; readonly reason: string }
  | {
      readonly type: "action";
      readonly id: number;
      readonly name: string;
      readonly input: unknown;
      readonly request: RscSerializedRequest;
      readonly context?: RuntimeContext;
    };

export type RscWorkerRoute = {
  readonly path: string;
  readonly head?: HeadMetadata;
};

export type RscWorkerMessage =
  | {
      readonly type: "ready";
      readonly routes: readonly RscWorkerRoute[];
      readonly clientEntryUrl: string;
      readonly actions: readonly string[];
    }
  | { readonly type: "failed"; readonly artifact: string; readonly reason: string }
  | { readonly type: "started"; readonly id: number }
  | { readonly type: "chunk"; readonly id: number; readonly bytes: Uint8Array }
  | { readonly type: "end"; readonly id: number; readonly embeddedFlight?: string }
  | { readonly type: "error"; readonly id: number; readonly error: RscSerializedError }
  | { readonly type: "action-result"; readonly id: number; readonly value: unknown };
