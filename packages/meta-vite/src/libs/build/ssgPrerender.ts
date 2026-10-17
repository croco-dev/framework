import { Problem, ProblemCategory } from "@croco/problems-core";
import type { BuildArtifact } from "@croco/presentation-preset";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";

class SsgOutputConflictProblem extends Problem {
  readonly code = "CROCO_META_VITE_SSG_OUTPUT_CONFLICT";
  readonly category = ProblemCategory.Conflict;

  constructor(outputPath: string, firstRoute: string, secondRoute: string) {
    super(
      "CROCO_META_VITE_SSG_OUTPUT_CONFLICT",
      ProblemCategory.Conflict,
      `SSG routes '${firstRoute}' and '${secondRoute}' produce the same output path '${outputPath}'`,
      { extensions: { outputPath, routes: [firstRoute, secondRoute] } },
    );
  }
}

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
  const outputRoutes = new Map<string, string>();
  const ssgRoutes = routes
    .filter((route) => route.mode === "ssg")
    .map((route) => {
      const path = getStaticHtmlPath(route.path);
      const firstRoute = outputRoutes.get(path);
      if (firstRoute !== undefined) {
        throw new SsgOutputConflictProblem(path, firstRoute, route.path);
      }
      outputRoutes.set(path, route.path);
      return { route, path };
    });

  return Promise.all(
    ssgRoutes.map(async ({ route, path }) => ({
      path,
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
