export type PageRouteOptions = {
  readonly name: string;
  readonly kebab: string;
  readonly path: string;
  readonly mode: "ssr" | "spa";
};

export function pageRoute(options: PageRouteOptions): string {
  if (options.mode === "spa") {
    return `import type { RouteObject } from 'react-router';
import Page from './Page';

export const routeConfig = {
  path: '${options.path}',
  Component: Page,
} satisfies RouteObject;
`;
  }

  return `import { createCrocoPageConfig } from '@croco/frontend-react';

export const routeConfig = {
  path: '${options.path}',
  component: {
    config: createCrocoPageConfig(),
  },
};
`;
}
