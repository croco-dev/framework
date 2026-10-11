/** @packageDocumentation Firebase Cloud Messaging notification adapter. */
export { FcmProvider, FCM_PROVIDER_CAPABILITIES } from "./libs/FcmProvider";
export { FcmDiagnosticsProvider } from "./libs/FcmDiagnosticsProvider";
export { FcmProblem, normalizeFcmProblem } from "./libs/FcmProblem";
export { validateFcmConfig } from "./libs/FcmConfig";
export type { FcmConfig } from "./libs/FcmConfig";
export type { FcmClient, FcmProviderOptions } from "./libs/FcmProvider";
export type { FcmDiagnosticsOptions } from "./libs/FcmDiagnosticsProvider";
export type { FcmFailureKind } from "./libs/FcmProblem";
