export type PageRouteOptions = {
  readonly path: string;
  readonly mode: "ssr" | "spa";
};

export function pageRoute(options: PageRouteOptions): string {
  if (options.mode === "spa") {
    return `import Page from './Page';

export const routeConfig = {
  path: '${options.path}',
  Component: Page,
};
`;
  }

  return `import { defineRoute, type PageRouteDefinition } from '@croco/meta-vite';
import Page from './Page';

const route = {
  path: '${options.path}',
  mode: 'ssr',
  component: Page,
} satisfies PageRouteDefinition;

export default defineRoute(route);
`;
}
