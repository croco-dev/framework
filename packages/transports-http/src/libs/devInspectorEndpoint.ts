import {
  Container,
  DEV_INSPECTOR_TOKEN,
  RuntimeInspector,
  type RuntimeInspectorOptions,
} from "@croco/framework-context";
import type { Context as HonoContext } from "hono";
import type { DiagnosticsAccessContext, DiagnosticsGuard } from "./operationalEndpoints";

export const DEV_INSPECTOR_ENDPOINT_PATH = "/dev/inspector";
export const DEV_INSPECTOR_TOKEN_HEADER = "X-Dev-Inspector-Token";

export type DevInspectorExposureMode = "off" | "private" | "token" | "custom";

export type DevInspectorEndpointOptions = RuntimeInspectorOptions & {
  readonly exposure?: DevInspectorExposureMode;
  readonly token?: string;
  readonly tokenHeader?: string;
  readonly guard?: DiagnosticsGuard;
  readonly inspector?: RuntimeInspector;
  readonly allowProduction?: boolean;
};

export type DevInspectorEndpointPolicy = Required<
  Pick<DevInspectorEndpointOptions, "exposure" | "tokenHeader" | "allowProduction">
> &
  RuntimeInspectorOptions &
  Pick<DevInspectorEndpointOptions, "token" | "guard" | "inspector">;

export function resolveDevInspectorEndpointPolicy(
  options: DevInspectorEndpointOptions | undefined,
  env: NodeJS.ProcessEnv = process.env,
): DevInspectorEndpointPolicy {
  const token = options?.token ?? env.CROCO_DEV_INSPECTOR_TOKEN;
  const envExposure = parseDevInspectorExposure(env.CROCO_DEV_INSPECTOR_EXPOSURE);
  const envEnabled = env.CROCO_DEV_INSPECTOR_ENABLED === "true";
  const requestedExposure =
    options?.exposure ?? envExposure ?? (envEnabled ? (token ? "token" : "private") : "off");
  const allowProduction = options?.allowProduction ?? false;
  const exposure = resolveProductionSafeExposure(requestedExposure, allowProduction, env);

  return {
    exposure,
    token,
    tokenHeader: options?.tokenHeader ?? DEV_INSPECTOR_TOKEN_HEADER,
    guard: options?.guard,
    inspector: options?.inspector,
    allowProduction,
    maxRequests: options?.maxRequests,
    maxEventsPerRequest: options?.maxEventsPerRequest,
    sensitiveKeyPattern: options?.sensitiveKeyPattern,
    maxStringLength: options?.maxStringLength,
  };
}

export function resolveDevInspector(policy: DevInspectorEndpointPolicy): RuntimeInspector {
  const inspector =
    policy.inspector ??
    new RuntimeInspector({
      maxRequests: policy.maxRequests,
      maxEventsPerRequest: policy.maxEventsPerRequest,
      sensitiveKeyPattern: policy.sensitiveKeyPattern,
      maxStringLength: policy.maxStringLength,
    });

  Container.set(DEV_INSPECTOR_TOKEN, inspector);
  return inspector;
}

export async function authorizeDevInspectorRequest(
  context: HonoContext,
  policy: DevInspectorEndpointPolicy,
): Promise<boolean> {
  if (policy.exposure === "off") {
    return false;
  }

  if (policy.exposure === "private") {
    return true;
  }

  if (policy.exposure === "token") {
    return Boolean(policy.token) && context.req.header(policy.tokenHeader) === policy.token;
  }

  if (!policy.guard) {
    return false;
  }

  return policy.guard(toDiagnosticsAccessContext(context));
}

function resolveProductionSafeExposure(
  exposure: DevInspectorExposureMode,
  allowProduction: boolean,
  env: NodeJS.ProcessEnv,
): DevInspectorExposureMode {
  if (env.NODE_ENV !== "production") {
    return exposure;
  }

  if (!allowProduction) {
    return "off";
  }

  return exposure === "private" ? "off" : exposure;
}

function parseDevInspectorExposure(
  value: string | undefined,
): DevInspectorExposureMode | undefined {
  if (value === "off" || value === "private" || value === "token" || value === "custom") {
    return value;
  }

  return undefined;
}

function toDiagnosticsAccessContext(context: HonoContext): DiagnosticsAccessContext {
  return {
    method: context.req.method,
    path: context.req.path,
    request: context.req.raw,
    header: (name) => context.req.header(name),
  };
}
