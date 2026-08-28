export type ModuleLifecyclePhase = "setup" | "start" | "shutdown";

export type ModuleLifecycleExecutionOptions = {
  /** Parent cancellation signal propagated to every hook in this lifecycle operation. */
  readonly signal?: AbortSignal;
  /** Absolute Unix timestamp in milliseconds shared by every hook in this lifecycle operation. */
  readonly deadline?: number;
};

export type ModuleLifecycleFailure = {
  readonly moduleName: string;
  readonly phase: ModuleLifecyclePhase;
  readonly code: string;
  readonly message: string;
};

export type ModuleCleanupFailure = Omit<ModuleLifecycleFailure, "phase"> & {
  readonly phase: "shutdown";
};
