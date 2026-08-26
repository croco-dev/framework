export type PageRouteOptions = {
  readonly path: string;
  readonly mode: "ssr" | "spa";
};

export function pageRoute(options: PageRouteOptions): string {
  const pathLiteral = toTypeScriptStringLiteral(options.path);

  if (options.mode === "spa") {
    return `import Page from './Page';

export const routeConfig = {
  path: ${pathLiteral},
  Component: Page,
};
`;
  }

  return `import { defineRoute, type PageRouteDefinition } from '@croco/meta-vite';
import Page from './Page';

const route = {
  path: ${pathLiteral},
  mode: 'ssr',
  component: Page,
} satisfies PageRouteDefinition;

export default defineRoute(route);
`;
}

function toTypeScriptStringLiteral(value: string): string {
  const literal = JSON.stringify(value) as string;

  return literal.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
