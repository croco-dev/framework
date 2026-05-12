export type PageTsxOptions = {
  readonly name: string;
  readonly kebab: string;
  readonly mode: "ssr" | "spa";
};

export function pageTsx(options: PageTsxOptions): string {
  if (options.mode === "spa") {
    return `import { usePageData } from '@croco/frontend-react';

type ${options.name}PageData = {
  readonly title?: string;
};

export default function ${options.name}Page() {
  const data = usePageData<${options.name}PageData>();
  const title = data.title ?? '${options.name}';

  return (
    <main>
      <h1>{title}</h1>
      <p>${options.name} page</p>
    </main>
  );
}
`;
  }

  return `import { createCrocoPageConfig, createIsomorphicPageConfig } from '@croco/frontend-react';
import type { RouteObject } from 'react-router';

export const routeConfig = createIsomorphicPageConfig({
  path: '/${options.kebab}',
  component: {
    config: createCrocoPageConfig(),
  },
}) satisfies RouteObject;

export default function ${options.name}Page() {
  return (
    <main>
      <h1>${options.name}</h1>
      <p>${options.name} page</p>
    </main>
  );
}
`;
}
