import type { FrontendTelemetryBridge } from "../libs/frontendBridge";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Assert<Condition extends true> = Condition;

export type FrontendTelemetryRecordReturnContract = Assert<
  Equal<ReturnType<FrontendTelemetryBridge["record"]>, void | Promise<void>>
>;
