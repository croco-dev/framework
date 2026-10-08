import { RscClientReferenceMissingProblem } from "./flight";
import type { ComponentType, ReactElement } from "react";
import type { RenderRouteComponentProps } from "../routes/types";

export type RscSsrDecodeOptions = {
  readonly routePath: string;
  readonly head?: () => { title?: string; description?: string; canonical?: string } | undefined;
};

export type RscClientManifestLike = {
  readonly moduleMap: Record<string, unknown>;
  readonly serverModuleMap: Record<string, unknown>;
};

export type RscSsrCodec = {
  readonly decodeFlight: (
    flight: ReadableStream<Uint8Array>,
    manifest: RscClientManifestLike,
  ) => Promise<unknown>;
  readonly renderHtmlStream: (
    node: unknown,
    options?: RscSsrDecodeOptions,
  ) => Promise<ReadableStream<Uint8Array>>;
  readonly renderHtmlString: (node: unknown) => string;
  readonly emptyManifest: () => RscClientManifestLike;
};

export type RscSsrDecodeResult = {
  readonly node: unknown;
  readonly htmlStream: ReadableStream<Uint8Array>;
};

export async function decodeFlightToHtmlStream(
  codec: RscSsrCodec,
  flight: ReadableStream<Uint8Array>,
  options: RscSsrDecodeOptions,
): Promise<RscSsrDecodeResult> {
  const node = await codec.decodeFlight(flight, codec.emptyManifest());
  assertNoUnresolvedClientReference(options.routePath, node);
  const htmlStream = await codec.renderHtmlStream(node, options);

  return { node, htmlStream };
}

export function decodeFlightToHtmlString(codec: RscSsrCodec, node: unknown): string {
  return codec.renderHtmlString(node);
}

export function toHtmlStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export function flightBytesToStream(raw: string | Uint8Array): ReadableStream<Uint8Array> {
  const bytes = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return result;
    }
    result += decoder.decode(value, { stream: true });
  }
}

export type RscLazySsrCodec = () => Promise<RscSsrCodec>;

let cachedCodec: RscSsrCodec | undefined;

export async function loadRscSsrCodec(lazy: RscLazySsrCodec): Promise<RscSsrCodec> {
  cachedCodec ??= await lazy();
  return cachedCodec;
}

export function resetRscSsrCodecCache(): void {
  cachedCodec = undefined;
}

export function createRscElement(
  createElement: (
    type: ComponentType<RenderRouteComponentProps>,
    props: RenderRouteComponentProps,
  ) => ReactElement,
  component: ComponentType<RenderRouteComponentProps>,
  props: RenderRouteComponentProps,
): ReactElement {
  return createElement(component, props);
}

const LAZY_MARKER_KEYS = new Set(["$typeof", "_payload", "_init"]);

function assertNoUnresolvedClientReference(routePath: string, node: unknown): void {
  if (!isLazyReference(node) || node === null || typeof node !== "object") {
    return;
  }

  throw new RscClientReferenceMissingProblem(routePath, describeLazyReference(node));
}

function isLazyReference(node: unknown): boolean {
  if (typeof node !== "object" || node === null) {
    return false;
  }

  return LAZY_MARKER_KEYS.has((node as Record<string, unknown>)["$typeof"] as string);
}

function describeLazyReference(node: object): string {
  const payload = (node as Record<string, unknown>)["_payload"];

  if (payload && typeof payload === "object") {
    const id = (payload as Record<string, unknown>)["id"];
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }

  return "unknown-client-reference";
}
