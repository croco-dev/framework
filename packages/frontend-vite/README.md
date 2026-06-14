# @croco/frontend-vite

> Croco Presentation Tier — 5th layer: Framework → Protocols → Transports → Integrations → Presentation

Cloudflare Workers + Vite + Vike 통합 플러그인 패키지입니다.

이 패키지는 Cloudflare Workers 환경에서 Vite와 Vike를 함께 사용하기 위한 플러그인을 제공합니다.

## 설치

```bash
pnpm add @croco/frontend-vite
```

Cloudflare 통합을 사용하는 기본 설정(`crocoVitePlugin()`)에는 선택적 peer dependency인 `@cloudflare/vite-plugin`도 필요합니다:

```bash
pnpm add @cloudflare/vite-plugin
```

Cloudflare 통합을 사용하지 않는 Vite 설정은 `cloudflare: false`를 지정하면 `@cloudflare/vite-plugin` 없이도 패키지 엔트리포인트를 import할 수 있습니다.

## 사용법

### Vite 설정

`vite.config.ts`에서 플러그인을 설정합니다:

```typescript
import { crocoVitePlugin } from "@croco/frontend-vite";

export default {
  plugins: crocoVitePlugin(),
};
```

### 옵션

```typescript
import { crocoVitePlugin } from "@croco/frontend-vite";

export default {
  plugins: crocoVitePlugin({
    ssr: true,
    cloudflare: true,
  }),
};
```

## API

### `crocoVitePlugin(options?)`

Cloudflare Workers + Vite + Vike 통합 플러그인을 반환합니다.

**옵션:**

- `ssr?: boolean` - SSR 활성화 여부 (기본값: `true`)
- `cloudflare?: boolean` - Cloudflare Workers 타겟 여부 (기본값: `true`)

**반환값:** `PluginOption[]` - Vite 플러그인 옵션 배열

## 타입

### `CrocoViteOptions`

플러그인 옵션 타입입니다.

```typescript
export type CrocoViteOptions = {
  ssr?: boolean;
  cloudflare?: boolean;
};
```

### `CrocoViteConfig`

플러그인 설정 타입입니다.

```typescript
export type CrocoViteConfig = {
  plugins: PluginOption[];
};
```

## 예제

### 기본 설정

```typescript
import { defineConfig } from "vite";
import { crocoVitePlugin } from "@croco/frontend-vite";

export default defineConfig({
  plugins: crocoVitePlugin(),
});
```

### SSR 비활성화

```typescript
import { defineConfig } from "vite";
import { crocoVitePlugin } from "@croco/frontend-vite";

export default defineConfig({
  plugins: crocoVitePlugin({ ssr: false }),
});
```

### Cloudflare 비활성화

```typescript
import { defineConfig } from "vite";
import { crocoVitePlugin } from "@croco/frontend-vite";

export default defineConfig({
  plugins: crocoVitePlugin({ cloudflare: false }),
});
```

## 라이선스

MIT
