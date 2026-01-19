# @croco/esbuild-plugin

esbuild 플러그인 - reflect-metadata 자동 주입 및 @Component 파일 스캔

## 설치

```bash
pnpm add @croco/esbuild-plugin
```

## 사용법

### 기본 (Zero Config)

```typescript
import * as esbuild from 'esbuild';
import { crocoPlugin } from '@croco/esbuild-plugin';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  plugins: [crocoPlugin()],
});
```

### 커스텀 설정

```typescript
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  plugins: [
    crocoPlugin({
      reflectMetadata: true,  // reflect-metadata 자동 주입 (기본값: true)
      scan: {
        dirs: ['src', 'lib'],        // 스캔 디렉토리 (기본값: ['src'])
        exclude: ['**/*.test.ts'],   // 제외 패턴 (기본값: 테스트 파일 제외)
        decorators: ['Component'],   // 탐지할 데코레이터 (기본값: ['Component'])
        cache: true,                 // 캐시 사용 (기본값: true)
      },
    }),
  ],
});
```

## 기능

### 1. reflect-metadata 자동 주입

Entry point 파일의 맨 첫 줄에 `import 'reflect-metadata';`를 자동 추가합니다.

### 2. @Component 파일 스캔

지정된 디렉토리에서 `@Component` 데코레이터가 있는 파일을 탐지합니다.

## API

### crocoPlugin(config?)

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `reflectMetadata` | boolean | `true` | reflect-metadata 자동 주입 |
| `scan.dirs` | string[] | `['src']` | 스캔할 디렉토리 |
| `scan.exclude` | string[] | 테스트 파일 제외 | 제외할 패턴 |
| `scan.decorators` | string[] | `['Component']` | 탐지할 데코레이터 |
| `scan.cache` | boolean | `true` | 파일 변경 캐시 사용 |

## 예제

```typescript
// esbuild.config.ts
import * as esbuild from 'esbuild';
import { crocoPlugin } from '@croco/esbuild-plugin';

export default async () => {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    outdir: 'dist',
    bundle: true,
    plugins: [crocoPlugin()],
  });
};
```
