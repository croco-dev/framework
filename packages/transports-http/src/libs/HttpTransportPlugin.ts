import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import { Token } from "@croco/framework-context";
import {
  defineCrocoModule,
  defineCrocoPlugin,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import type { ApplicationRuntime, PluginFactory } from "@croco/framework-module";
import type { Constructor } from "@croco/protocols-rest";
import type { AppConfig, MiddlewareFunction } from "./types";

export type HttpControllerContribution = {
  readonly id: string;
  readonly controller: Constructor;
  readonly order?: number;
};

export type HttpMiddlewareContribution = {
  readonly id: string;
  readonly middleware: MiddlewareFunction;
  readonly order?: number;
};

export type HttpTransportRuntimeOptions = Omit<AppConfig, "controllers" | "middlewares">;

export type HttpTransportPluginOptions = HttpTransportRuntimeOptions & {
  readonly controllers?: readonly HttpControllerContribution[];
  readonly middlewares?: readonly HttpMiddlewareContribution[];
};

export const HTTP_TRANSPORT_OPTIONS_TOKEN = new Token<HttpTransportRuntimeOptions>(
  "HttpTransportOptions",
);

export const httpTransport: PluginFactory<HttpTransportPluginOptions> = (options) => {
  const { controllers = [], middlewares = [], ...runtimeOptions } = options;

  return defineCrocoPlugin({
    metadata: {
      name: "transports-http",
      packageName: "@croco/transports-http",
      maturity: "production",
      providedContracts: ["@croco/protocols-rest", "@croco/transports-http/AppConfig"],
      capabilities: [
        { id: "http.transport", kind: "single" },
        { id: MODULE_CONTRIBUTION_KINDS.httpController, kind: "multi" },
        { id: MODULE_CONTRIBUTION_KINDS.httpMiddleware, kind: "multi" },
        { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
      ],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "CROCO_HTTP_DI_VALIDATION",
          required: false,
          description: "Optional DI validation mode override.",
        },
        {
          key: "CROCO_HTTP_SECURITY_VALIDATION",
          required: false,
          description: "Optional security validation mode override.",
        },
        {
          key: "CROCO_DIAGNOSTICS_TOKEN",
          required: false,
          sensitive: true,
          description: "Optional diagnostics endpoint access token.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/transports-http test",
          reference: "packages/transports-http/src/tests/HttpTransportPlugin.spec.ts",
        },
      ],
      examples: ["packages/transports-http/README.md"],
    },
    modules: [
      defineCrocoModule({
        name: "transports-http",
        providers: [
          {
            provide: HTTP_TRANSPORT_OPTIONS_TOKEN,
            useValue: Object.freeze({ ...runtimeOptions }),
          },
        ],
        exports: [HTTP_TRANSPORT_OPTIONS_TOKEN],
        controllers: controllers.map((contribution) => contribution.controller),
        contributions: [
          ...controllers.map((contribution) => ({
            kind: MODULE_CONTRIBUTION_KINDS.httpController,
            id: contribution.id,
            ...(contribution.order === undefined ? {} : { order: contribution.order }),
            value: contribution.controller,
          })),
          ...middlewares.map((contribution) => ({
            kind: MODULE_CONTRIBUTION_KINDS.httpMiddleware,
            id: contribution.id,
            ...(contribution.order === undefined ? {} : { order: contribution.order }),
            value: contribution.middleware,
          })),
        ],
      }),
    ],
  });
};

export function createHttpAppConfig(runtime: ApplicationRuntime): AppConfig {
  const options = runtime.get(HTTP_TRANSPORT_OPTIONS_TOKEN);
  const controllers = runtime
    .getContributions<Constructor>(MODULE_CONTRIBUTION_KINDS.httpController)
    .map((contribution) => contribution.value);
  const middlewares = runtime
    .getContributions<MiddlewareFunction>(MODULE_CONTRIBUTION_KINDS.httpMiddleware)
    .map((contribution) => contribution.value);
  const contributedDiagnostics = runtime
    .getContributions<DiagnosticsProvider>(MODULE_CONTRIBUTION_KINDS.diagnosticsProvider)
    .map((contribution) => contribution.value);
  const configuredDiagnostics = options.diagnostics?.providers ?? [];
  const providers = [...configuredDiagnostics, ...contributedDiagnostics];
  const diagnostics =
    options.diagnostics || providers.length > 0 ? { ...options.diagnostics, providers } : undefined;

  return {
    ...options,
    controllers,
    ...(middlewares.length > 0 ? { middlewares } : {}),
    ...(diagnostics ? { diagnostics } : {}),
  };
}
