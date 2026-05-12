import type { BuildArtifact } from "@croco/presentation-preset";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";

export type SsgRenderedArtifact = BuildArtifact & {
  readonly html: string;
};

export type SsgRenderFunction = (
  route: RenderRouteIR,
  props: RenderRouteComponentProps,
) => Promise<string> | string;

export async function prerenderSsgRoutes(
  routes: readonly RenderRouteIR[],
  render: SsgRenderFunction = renderRouteToString,
): Promise<readonly SsgRenderedArtifact[]> {
  const ssgRoutes = routes.filter((route) => route.mode === "ssg");

  return Promise.all(
    ssgRoutes.map(async (route) => ({
      path: getStaticHtmlPath(route.path),
      format: "esm" as const,
      type: "asset" as const,
      html: await render(route, createStaticProps(route.path)),
    })),
  );
}

export async function renderRouteToString(
  route: RenderRouteIR,
  props: RenderRouteComponentProps,
): Promise<string> {
  const module = await route.componentLoader();

  return renderToString(createElement(module.default, props));
}

function createStaticProps(path: string): RenderRouteComponentProps {
  return { request: new Request(`https://static.croco.local${path}`) };
}

function getStaticHtmlPath(path: string): string {
  if (path === "/") {
    return "index.html";
  }

  return `${path.replace(/^\/+|\/+$/g, "")}/index.html`;
}
