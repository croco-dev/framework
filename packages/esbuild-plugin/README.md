# @croco/esbuild-plugin

Croco의 compile-time DI graph를 생성하고 server bundle에 연결하는 esbuild plugin입니다.

## 설치

```bash
pnpm add -D @croco/esbuild-plugin esbuild typescript
```

## 기본 사용법

```typescript
import * as esbuild from "esbuild";
import { crocoPlugin } from "@croco/esbuild-plugin";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  platform: "node",
  bundle: true,
  plugins: [crocoPlugin()],
});
```

기본 스캔 root는 `src`입니다. plugin은 import graph에 연결되지 않은 파일도 포함해 Croco stereotype을
symbol identity로 찾고 `.croco/di.generated.ts`와 `.croco/di.manifest.json`을 생성합니다. 생성 TS에는 실제
constructor 호출과 token lookup이 있으므로 runtime reflection fallback이 필요하지 않습니다. watch rebuild도
같은 compiler를 실행하며 add, remove, rename을 입력 hash와 함께 반영합니다.
server entry는 `createApplicationRuntime(...)`을 composition root로 사용해야 합니다. plugin은 생성 graph를 이
호출의 두 번째 인자로 연결하며, entry 또는 generated module을 import하는 것만으로 전역 container를 변경하지
않습니다.

`*.test.ts`, `*.spec.ts`, `__tests__`, `fixtures`, `benchmarks`, `scripts`, `.croco`, `generated`, `client`,
`node_modules`는 기본 제외됩니다. browser build에는 server graph를 생성하거나 주입하지 않습니다.

## 지원되는 작성 패턴

```typescript
import { Component, Inject, Token } from "@croco/framework-context";

export interface PaymentGateway {
  charge(): Promise<void>;
}

export const PAYMENT_GATEWAY = new Token<PaymentGateway>("payments.gateway");

@Component({ scope: "request" })
export class CheckoutService {
  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
    private readonly pricing: PricingService,
  ) {}
}
```

- exported `@Component`, `@Controller`, `@GraphQLResolver` class
- 유일하게 결정되는 concrete class constructor dependency
- 정적으로 참조 가능한 `@Inject(TOKEN)`과 `@Inject(() => Service)`
- 누락 시 `undefined`를 전달하는 정적 `@InjectOptional(TOKEN)`
- identifier property의 `@Inject`와 `@InjectMany`
- `singleton`, `request`, `transient` scope

interface, union, generic, primitive 설정값은 `@Inject(TOKEN)`이 필요합니다. 동적으로 계산한 token/options,
non-exported/default-export provider, computed/private property injection은 source 위치가 포함된 compile error입니다.
singleton→request capture와 eager constructor cycle도 생성 전에 실패합니다.

## 설정

```typescript
crocoPlugin({
  reflectMetadata: true,
  scan: {
    dirs: ["src", "server"],
    exclude: ["**/*.fixture.ts", "**/client/**"],
  },
  di: {
    graphId: "checkout-api",
    outFile: ".croco/di.generated.ts",
    manifestFile: ".croco/di.manifest.json",
    tsconfig: "tsconfig.json",
    packageDescriptors: ["@acme/payments/croco-di.json"],
    bindings: [
      {
        token: {
          moduleSpecifier: "./src/payments/tokens",
          exportName: "PAYMENT_GATEWAY",
        },
        useExisting: {
          moduleSpecifier: "./src/payments/StripePaymentGateway",
          exportName: "StripePaymentGateway",
        },
      },
    ],
    modules: [
      {
        id: "payments",
        providers: [
          "app:src/payments/tokens#PAYMENT_GATEWAY",
          "app:src/payments/StripePaymentGateway#StripePaymentGateway",
        ],
        exports: ["app:src/payments/tokens#PAYMENT_GATEWAY"],
      },
    ],
  },
});
```

| 옵션                    | 기본값                    | 설명                                                                                                         |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `reflectMetadata`       | `true`                    | 비-DI decorator 소비자를 위해 entry에 `reflect-metadata`를 주입합니다. DI compiler는 이를 사용하지 않습니다. |
| `scan.dirs`             | `["src"]`                 | 앱 server source root입니다.                                                                                 |
| `scan.exclude`          | 안전한 기본 제외 목록     | candidate에서 제외할 glob입니다.                                                                             |
| `di.enabled`            | `true`                    | server build의 graph 생성과 entry 연결을 제어합니다.                                                         |
| `di.graphId`            | package directory name    | HMR/rebuild에서 교체할 앱 graph identity입니다.                                                              |
| `di.outFile`            | `.croco/di.generated.ts`  | generated factory module입니다.                                                                              |
| `di.manifestFile`       | `.croco/di.manifest.json` | inspect 가능한 compiler manifest입니다.                                                                      |
| `di.tsconfig`           | 자동 검색                 | 앱과 같은 TypeScript symbol resolution 설정입니다.                                                           |
| `di.packageDescriptors` | `[]`                      | 앱이 선택한 package의 versioned generated graph descriptor입니다. `node_modules` 전체를 스캔하지 않습니다.   |
| `di.bindings`           | `[]`                      | 정적 token→provider binding입니다. `multiple` 순서와 `override`를 graph 검증 전에 적용합니다.                |
| `di.modules`            | `[]`                      | provider token ID의 소유권과 module imports/exports 가시성을 선언합니다.                                     |

로컬 token ID는 `app:<확장자를 뺀 source path>#<export name>`, package descriptor token ID는
`package:<package name>#<export name>` 형식입니다. module은 provider를 하나만 소유할 수 있으며 다른 module의
provider는 해당 module을 import하고 token이 export된 경우에만 참조할 수 있습니다.

첫 compiler schema는 provider 상속을 지원하지 않습니다. 상속된 constructor/property injection을 누락하지 않고
compile error로 거절하므로, 주입 대상 provider에는 constructor와 injected property를 직접 선언해야 합니다.

`compileDiGraph()`과 `writeDiGraph()`은 test/build tooling에서 같은 compiler를 직접 실행할 때 사용할 수 있습니다.

## 패키지 descriptor

라이브러리는 source가 없는 tarball에서도 연결할 수 있도록 빌드한 graph와 descriptor를 함께 배포할 수 있습니다.
`createDiPackageDescriptor()`는 compiler/schema version, 입력 hash, 공개 provider, graph export를 고정하고
`writeDiPackageDescriptor()`가 JSON 산출물을 기록합니다. 앱은 선택한 descriptor만 `di.packageDescriptors`에 넣습니다.
descriptor의 graph export가 제공하는 factory가 실제 runtime graph에 그대로 합쳐지므로 앱 compiler가 `.d.ts`에서
decorator metadata를 추측하거나 패키지 모듈을 실행하지 않습니다. 중복 token과 동일 package의 version 충돌은
앱 graph 생성 전에 실패합니다.

```typescript
const result = compileDiGraph({
  baseDir: packageRoot,
  graphId: "@acme/payments",
  packageName: "@acme/payments",
});
writeDiGraph(result);
writeDiPackageDescriptor(
  "dist/croco.di.json",
  createDiPackageDescriptor(result, {
    packageName: "@acme/payments",
    packageVersion: "1.0.0",
    graphImport: "./di.generated.js",
  }),
);
```
