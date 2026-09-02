export const MODULE_CONTRIBUTION_KINDS = {
  diagnosticsProvider: "diagnostics.provider",
  eventHandler: "event.handler",
  httpController: "http.controller",
  httpMiddleware: "http.middleware",
  httpRoute: "http.route",
  lifecycleResource: "lifecycle.resource",
  taskHandler: "task.handler",
  triggerHandler: "trigger.handler",
} as const;

export type ModuleContributionKind =
  (typeof MODULE_CONTRIBUTION_KINDS)[keyof typeof MODULE_CONTRIBUTION_KINDS];
