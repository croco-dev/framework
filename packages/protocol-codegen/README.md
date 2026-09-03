# @croco/protocol-codegen

Shared TypeScript project loading for Croco protocol generators.

The package gives RPC and OpenAPI generation one deterministic contract for application tsconfig discovery, compiler diagnostics, temporary JavaScript emission, runtime path-alias rewriting, and module loading. An explicit `tsconfigPath` takes precedence; otherwise the nearest `tsconfig.json` above the matched controller sources is used. Projects without a config retain the legacy CommonJS/ES2020 analysis defaults.

```ts
import { createControllerProject } from "@croco/protocol-codegen";

const controllerProject = createControllerProject({
  controllers: "src/controllers/**/*.ts",
  tsconfigPath: "tsconfig.json",
});

try {
  controllerProject.emit();
  const modules = await controllerProject.importControllerModules();
  console.log(modules.length);
} finally {
  controllerProject.dispose();
}
```

Missing, unreadable, or invalid selected configs fail with `CROCO_BUILD_004` and include the resolved absolute path, reason, and recovery action. The loader parses TypeScript configuration only; it does not execute application build scripts or TypeScript language-service plugins.

Protocol generators can use `loadRestControllerSources` to share controller discovery, REST decorator and parameter source locations, TypeScript diagnostics, emission, and module import. Source locations are relative to the common directory of the explicitly matched controller files and use forward slashes, so imports outside the controller glob do not change them. Each consuming generator supplies Problem factories so its public codes and diagnostic prefixes remain stable.

```ts
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
  formatControllerTypeScriptDiagnostics,
  getNoRestControllersFoundMessage,
  loadRestControllerSources,
} from "@croco/protocol-codegen";

const { controllers, modules } = await loadRestControllerSources({
  controllers: "src/controllers/**/*.ts",
  problems: {
    noControllersFound: (patterns) =>
      new Problem(
        "example-codegen/no-rest-controllers-found",
        ProblemCategory.BadRequest,
        getNoRestControllersFoundMessage(patterns),
      ),
    controllerTypeScriptDiagnostics: (patterns, diagnostics) =>
      new Problem(
        "example-codegen/controller-typescript-diagnostics",
        ProblemCategory.ValidationError,
        formatControllerTypeScriptDiagnostics("example-codegen", patterns, diagnostics),
        {
          extensions: {
            crocoCode: CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
            diagnostics,
          },
        },
      ),
  },
});
```
