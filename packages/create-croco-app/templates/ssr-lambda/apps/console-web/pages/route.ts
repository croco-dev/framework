import { defineRoute, head } from '@croco/meta-vite';
import type Page from './index/Page';

export default defineRoute({
  path: '/',
  mode: 'ssr',
  component: Page satisfies typeof import('./index/Page').default,
  head: head({ title: 'Croco Console' }),
});
