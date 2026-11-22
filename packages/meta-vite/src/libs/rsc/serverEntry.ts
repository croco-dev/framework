/**
 * `@croco/meta-vite/rsc/server`: helper for the app's `rsc` Vite entry.
 *
 * It is bundled into the `rsc` environment, where `react` resolves under the
 * `react-server` condition, so it must never import `react-dom/server` or the
 * package root. The Flight encoder is passed in from `@vitejs/plugin-rsc/rsc`
 * because that module only resolves inside the app's Vite build.
 */
import { createElement } from "react";
import { createRscComponentProps } from "./flight";
import { RSC_SERVER_ENTRY_VERSION, RscRouteNotInBuildProblem } from "./buildEntry";
import type { ComponentType } from "react";
import type { HeadMetadata } from "../routes/head";
import type { RenderRouteComponentProps } from "../routes/types";
import type { RscFlightRenderInput, RscServerEntry } from "./buildEntry";

export type RscServerRouteDefinition = {
  readonly path: string;
  readonly component: ComponentType<RenderRouteComponentProps>;
  readonly head?: () => HeadMetadata;
};

export type RscFlightRenderToReadableStream = (
  element: unknown,
  options: { readonly signal: AbortSignal },
) => ReadableStream<Uint8Array>;

export type RscServerEntryOptions = {
  readonly routes: readonly RscServerRouteDefinition[];
  /** `renderToReadableStream` from `@vitejs/plugin-rsc/rsc`. */
  readonly renderToReadableStream: RscFlightRenderToReadableStream;
};

export function defineRscServerEntry(options: RscServerEntryOptions): RscServerEntry {
  const components = new Map(options.routes.map((route) => [route.path, route.component]));

  return {
    version: RSC_SERVER_ENTRY_VERSION,
    routes: options.routes.map(({ path, head }) => (head ? { path, head } : { path })),
    renderFlight(input: RscFlightRenderInput) {
      const component = components.get(input.route);
      if (!component) {
        throw new RscRouteNotInBuildProblem(input.route);
      }

      return options.renderToReadableStream(
        createElement(component, createRscComponentProps(input.request, input.context)),
        { signal: input.signal },
      );
    },
  };
}

export { RSC_SERVER_ENTRY_VERSION } from "./buildEntry";
export type { RscFlightRenderInput, RscServerEntry } from "./buildEntry";
