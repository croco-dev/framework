import { Problem, ProblemCategory } from "@croco/problems-core";
import type { EventBusActiveHandler, EventBusShutdownResult } from "../EventBusLifecycleTypes";

/**
 * EventBus가 설정되지 않은 상태에서 발행을 시도하면 발생하는 Problem입니다.
 */
export class EventBusNotSetProblem extends Problem {
  readonly code = "events-core/event-bus-not-set";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "EventBus has not been set. Call setEventBus() first.");
  }
}

/** Event intake has been permanently closed by the bus lifecycle. */
export class EventBusIntakeClosedProblem extends Problem {
  readonly code = "events-core/event-bus-intake-closed";
  readonly category = ProblemCategory.Conflict;

  constructor() {
    super(undefined, undefined, "EventBus intake is closed because shutdown has started.");
  }
}

/** EventBus drain timeout options must map to an exact bounded timer duration. */
export class InvalidEventBusDrainTimeoutProblem extends Problem {
  readonly code = "events-core/event-bus-drain-timeout-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(readonly timeoutMs: number) {
    super(
      undefined,
      undefined,
      `EventBus drain timeout must be an integer between 1 and 2147483647 milliseconds; received ${String(timeoutMs)}`,
    );
  }
}

/** A framework shutdown hook cannot report success while EventBus handlers remain unfinished. */
export class EventBusDrainIncompleteProblem extends Problem {
  readonly code = "events-core/event-bus-drain-incomplete";
  readonly category = ProblemCategory.InternalServerError;
  readonly drainStatus: Exclude<EventBusShutdownResult["status"], "drained">;
  readonly unfinishedHandlers: readonly EventBusActiveHandler[];

  constructor(
    drainStatus: Exclude<EventBusShutdownResult["status"], "drained">,
    unfinishedHandlers: readonly EventBusActiveHandler[],
  ) {
    const unfinishedHandlerSnapshot = unfinishedHandlers.map((handler) => ({ ...handler }));
    super(
      undefined,
      undefined,
      `EventBus drain ${drainStatus} with ${unfinishedHandlerSnapshot.length} unfinished handler(s).`,
      {
        extensions: {
          drainStatus,
          unfinishedHandlerCount: unfinishedHandlerSnapshot.length,
        },
      },
    );
    this.drainStatus = drainStatus;
    this.unfinishedHandlers = unfinishedHandlerSnapshot;
  }
}

/**
 * 이벤트 클래스에 `eventName`이 없을 때 발생하는 Problem입니다.
 */
export class EventDefinitionProblem extends Problem {
  readonly code = "events-core/event-definition-error";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "DomainEvent subclass must define static eventName");
  }
}

/**
 * 등록되지 않은 이벤트 타입을 역직렬화하려 할 때 발생하는 Problem입니다.
 */
export class UnknownEventTypeProblem extends Problem {
  readonly code = "events-core/unknown-event-type";
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventType: string) {
    super(undefined, undefined, `Unknown event type: '${eventType}'`);
  }
}

/**
 * 이벤트 역직렬화 중 오류가 발생했을 때 사용하는 Problem입니다.
 */
export class EventDeserializationError extends Problem {
  readonly code = "events-core/deserialization-error";
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventName: string, reason: string, options?: { cause?: Error }) {
    super(undefined, undefined, `Cannot deserialize event '${eventName}': ${reason}`, options);
  }
}

/**
 * 동일 이벤트 클래스에 중복 필드 메타데이터가 등록되면 발생하는 Problem입니다.
 */
export class DuplicateEventFieldProblem extends Problem {
  readonly code = "events-core/duplicate-event-field";
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventClassName: string, serializedKey: string) {
    super(
      undefined,
      undefined,
      `Duplicate event field mapping detected for '${eventClassName}' with serialized key '${serializedKey}'`,
    );
  }
}

/**
 * 같은 이벤트 이름이 두 번 등록되면 발생하는 Problem입니다.
 */
export class DuplicateEventNameProblem extends Problem {
  readonly code = "events-core/duplicate-event-name";
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventName: string) {
    super(
      undefined,
      undefined,
      `Duplicate event registration detected for eventName '${eventName}'`,
    );
  }
}

/**
 * 트랜잭션 컨텍스트 조회 자체가 실패했을 때 발생하는 Problem입니다.
 */
export class EventTransactionContextUnavailableProblem extends Problem {
  readonly code = "events-core/transaction-context-unavailable";
  readonly category = ProblemCategory.InternalServerError;
  constructor(reason: string) {
    super(
      undefined,
      undefined,
      `Transaction context unavailable during event publication: ${reason}`,
    );
  }
}

/**
 * 활성 트랜잭션 없이 after-commit 발행을 예약하면 발생하는 Problem입니다.
 */
export class EventAfterCommitRequiresActiveTransactionProblem extends Problem {
  readonly code = "events-core/after-commit-requires-active-transaction";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "publishAfterCommit requires an active transaction.");
  }
}

/**
 * after-commit 결과를 반환하지 않는 트랜잭션에서 이벤트 발행을 예약하면 발생하는 Problem입니다.
 */
export class EventAfterCommitOutcomeRequiredProblem extends Problem {
  readonly code = "events-core/after-commit-outcome-required";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(
      undefined,
      undefined,
      "publishAfterCommit requires a transaction that can return after-commit delivery evidence.",
    );
  }
}
