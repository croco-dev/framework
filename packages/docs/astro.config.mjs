// @ts-check

import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Croco Framework Documentation',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/yourusername/croco' }],
      plugins: [
        starlightTypeDoc({
          entryPoints: [
            '../framework-context/src/index.ts',
            '../retry-core/src/index.ts',
            '../problems-core/src/index.ts',
            '../events-core/src/index.ts',
            '../events-inmemory/src/index.ts',
            '../auth-core/src/index.ts',
            '../ratelimit-core/src/index.ts',
            '../metering-core/src/index.ts',
            '../transports-http/src/index.ts',
            '../telemetry-api/src/index.ts',
            '../telemetry-sdk-node/src/index.ts',
            '../llm-core/src/index.ts',
          ],
          tsconfig: './tsconfig.typedoc.json',
          typeDoc: {
            excludeInternal: true,
            excludePrivate: true,
            skipErrorChecking: true,
          },
          sidebar: {
            label: 'API Reference',
            collapsed: false,
          },
        }),
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [
            // Each item here is one entry in the navigation menu.
            { label: 'Example Guide', slug: 'guides/example' },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
