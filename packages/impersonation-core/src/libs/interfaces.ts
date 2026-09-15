import type { RequestContext } from "@croco/framework-context";
import { Token } from "@croco/framework-context";
import type {
  ImpersonationEndedEventIntent,
  ImpersonationLifecycleEventIntent,
  ImpersonationStartedEventIntent,
} from "./eventIntent";
import type { ImpersonationEndedEvent, ImpersonationStartedEvent } from "./events";
import type { ImpersonationState } from "./types";

export type ImpersonationPrincipal = {
  readonly id: string;
  readonly permissions: readonly string[];
};

export abstract class ImpersonationStore {
  static readonly token = new Token<ImpersonationStore>("ImpersonationStore");

  /**
   * Atomically claims the session's impersonator, persists the active session, and records its
   * pending started-event intent. Persistent stores must enforce unique session IDs and the actor
   * claim with uniqueness constraints or equivalent compare-and-set operations that replace an
   * expired actor claim in the same operation.
   */
  abstract commitStart(
    intent: ImpersonationStartedEventIntent,
  ): Promise<"committed" | "impersonator-active">;
  /**
   * Atomically revokes the active session and persists its pending ended-event intent.
   * Repeated commits for the same session and actor must retain the first canonical intent and
   * return its current publication status. Returns `committed-start-pending` when the started-event
   * intent still requires publication and `already-published` after the ended event is acknowledged.
   */
  abstract commitEnd(
    intent: ImpersonationEndedEventIntent,
    impersonatorId: string,
  ): Promise<
    | "actor-mismatch"
    | "already-published"
    | "committed"
    | "committed-start-pending"
    | "session-not-found"
  >;
  /** Returns the canonical committed end intent, including after publication acknowledgement. */
  abstract findCommittedEndIntent(sessionId: string): Promise<ImpersonationEndedEventIntent | null>;
  abstract find(sessionId: string): Promise<ImpersonationState | null>;
  abstract findByImpersonator(impersonatorId: string): Promise<ImpersonationState | null>;
  /** Lists oldest intents first and preserves started-before-ended ordering for each session. */
  abstract listPendingLifecycleEventIntents(
    limit?: number,
  ): Promise<readonly ImpersonationLifecycleEventIntent[]>;
  /** Idempotently acknowledges a published event intent. */
  abstract markLifecycleEventPublished(eventId: string): Promise<void>;
}

export abstract class AuthProvider {
  static readonly token = new Token<AuthProvider>("AuthProvider");

  abstract resolvePrincipal(context: RequestContext): Promise<ImpersonationPrincipal | null>;
  abstract targetExists(context: RequestContext, targetUserId: string): Promise<boolean>;
}

export abstract class ImpersonationLifecycleEventPublisher {
  static readonly token = new Token<ImpersonationLifecycleEventPublisher>(
    "ImpersonationLifecycleEventPublisher",
  );

  /** Must deduplicate retries and concurrent deliveries by `event.eventId`. */
  abstract publishIdempotently(
    event: ImpersonationStartedEvent | ImpersonationEndedEvent,
  ): Promise<void>;
}
