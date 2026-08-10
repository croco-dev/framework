import { Problem, ProblemCategory } from "@croco/problems-core";

/** Reports an invalid timeout passed to NodeEntry.close(). */
export class NodeEntryCloseTimeoutProblem extends Problem {
  public constructor(timeoutMs: number) {
    super(
      "preset-node/invalid-close-timeout",
      ProblemCategory.BadRequest,
      `Node entry close timeout must be a positive safe integer. Received ${timeoutMs}.`,
      {
        extensions: { timeoutMs },
      },
    );
  }
}

/** Reports start() on a Node entry that is already closing or closed. */
export class NodeEntryLifecycleProblem extends Problem {
  public constructor(operation: "start", state: "closing" | "closed") {
    super(
      "preset-node/lifecycle-conflict",
      ProblemCategory.Conflict,
      `Cannot ${operation} the Node entry while it is ${state}. Create a new entry to start another server.`,
      {
        extensions: { operation, state },
      },
    );
  }
}

/** Reports a Node server failure while starting or closing an entry. */
export class NodeEntryLifecycleIoProblem extends Problem {
  public constructor(operation: "start" | "close", cause: Error) {
    super(
      "preset-node/lifecycle-io-failed",
      ProblemCategory.InternalServerError,
      `Node entry ${operation} failed.`,
      {
        cause,
        extensions: { operation },
      },
    );
  }
}
