// @ts-check

import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';
import { sanitizeTypeDocIndex } from './scripts/sanitize-typedoc-index.mjs';

function sanitizeGeneratedTypeDocIndex() {
  return {
    name: 'sanitize-generated-typedoc-index',
    hooks: {
      'config:setup': async () => {
        await sanitizeTypeDocIndex();
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Croco Framework Documentation',
      defaultLocale: 'en',
      locales: {
        en: {
          label: 'English',
          lang: 'en',
        },
        ko: {
          label: '한국어',
          lang: 'ko',
        },
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/croco-dev/framework' }],
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
            disableSources: true,
            excludeInternal: true,
            excludePrivate: true,
            skipErrorChecking: true,
          },
          sidebar: {
            label: 'API Reference',
            collapsed: false,
          },
        }),
        sanitizeGeneratedTypeDocIndex(),
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
