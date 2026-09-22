import type {
  FrontendTelemetryBridge,
  FrontendTelemetryRequestLifecycle,
  FrontendTelemetryRequestOutcome,
  FrontendTelemetrySpanMode,
} from "../libs/frontendBridge";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Assert<Condition extends true> = Condition;

export type FrontendTelemetryRecordReturnContract = Assert<
  Equal<ReturnType<FrontendTelemetryBridge["record"]>, void | Promise<void>>
>;

export type FrontendTelemetryOptionalTraceContract = Assert<
  Equal<FrontendTelemetryBridge["traceparent"], string | undefined>
>;
export type FrontendTelemetryLifecycleContract = Assert<
  Equal<ReturnType<FrontendTelemetryBridge["startRequest"]>, FrontendTelemetryRequestLifecycle>
>;
export type FrontendTelemetryEndContract = Assert<
  Equal<
    Parameters<FrontendTelemetryRequestLifecycle["end"]>,
    [outcome: FrontendTelemetryRequestOutcome]
  >
>;
export type FrontendTelemetrySpanModeContract = Assert<
  Equal<FrontendTelemetrySpanMode, "propagate" | "client-span">
>;
