import { createHash } from "node:crypto";
import type { MembershipCreatedEventData } from "./events/MembershipCreatedEvent";
import type { MembershipRemovedEventData } from "./events/MembershipRemovedEvent";
import type { MembershipUpdatedEventData } from "./events/MembershipUpdatedEvent";
import { InvalidMembershipCommandProblem } from "./problems/MembershipProblems";
import type { MembershipCommand, MembershipCommandResult } from "./types";

export type MembershipEventIntentEvent =
  | {
      readonly eventId: string;
      readonly eventName: "membership.created";
      readonly occurredAt: Date;
      readonly data: MembershipCreatedEventData;
    }
  | {
      readonly eventId: string;
      readonly eventName: "membership.removed";
      readonly occurredAt: Date;
      readonly data: MembershipRemovedEventData;
    }
  | {
      readonly eventId: string;
      readonly eventName: "membership.updated";
      readonly occurredAt: Date;
      readonly data: MembershipUpdatedEventData;
    };

export type MembershipEventIntent = {
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly events: readonly MembershipEventIntentEvent[];
};

function stableId(kind: "intent" | "event", idempotencyKey: string, index = 0): string {
  return createHash("sha256").update(`membership:${kind}:${idempotencyKey}:${index}`).digest("hex");
}

export function createMembershipEventIntent(
  command: MembershipCommand,
  result: MembershipCommandResult,
  occurredAt: Date,
): MembershipEventIntent | null {
  if (
    (result.operation === "update_role" && result.previousRole === result.membership.role) ||
    (result.operation === "transfer_ownership" &&
      command.operation === "transfer_ownership" &&
      command.fromUserId === command.toUserId)
  ) {
    return null;
  }
  const eventOccurredAt = new Date(occurredAt);
  let events: readonly MembershipEventIntentEvent[];

  if (command.operation === "add" && result.operation === "add") {
    events = [
      {
        eventId: stableId("event", command.idempotencyKey),
        eventName: "membership.created",
        occurredAt: eventOccurredAt,
        data: { tenantId: command.tenantId, userId: command.userId, role: result.membership.role },
      },
    ];
  } else if (command.operation === "remove" && result.operation === "remove") {
    events = [
      {
        eventId: stableId("event", command.idempotencyKey),
        eventName: "membership.removed",
        occurredAt: eventOccurredAt,
        data: { tenantId: command.tenantId, userId: command.userId, role: result.membership.role },
      },
    ];
  } else if (command.operation === "update_role" && result.operation === "update_role") {
    events = [
      {
        eventId: stableId("event", command.idempotencyKey),
        eventName: "membership.updated",
        occurredAt: eventOccurredAt,
        data: {
          tenantId: command.tenantId,
          userId: command.userId,
          oldRole: result.previousRole,
          newRole: command.role,
        },
      },
    ];
  } else if (
    command.operation === "transfer_ownership" &&
    result.operation === "transfer_ownership"
  ) {
    events = [
      {
        eventId: stableId("event", command.idempotencyKey, 0),
        eventName: "membership.updated",
        occurredAt: eventOccurredAt,
        data: {
          tenantId: command.tenantId,
          userId: command.fromUserId,
          oldRole: "owner",
          newRole: result.fromMembership.role,
        },
      },
      {
        eventId: stableId("event", command.idempotencyKey, 1),
        eventName: "membership.updated",
        occurredAt: eventOccurredAt,
        data: {
          tenantId: command.tenantId,
          userId: command.toUserId,
          oldRole: result.previousToRole,
          newRole: result.toMembership.role,
        },
      },
    ];
  } else {
    throw new InvalidMembershipCommandProblem(
      `store returned '${result.operation}' for '${command.operation}'`,
    );
  }

  return {
    intentId: stableId("intent", command.idempotencyKey),
    idempotencyKey: command.idempotencyKey,
    events,
  };
}

export function cloneMembershipEventIntent(intent: MembershipEventIntent): MembershipEventIntent {
  return {
    ...intent,
    events: intent.events.map((event) => ({
      ...event,
      occurredAt: new Date(event.occurredAt),
      data: { ...event.data },
    })) as readonly MembershipEventIntentEvent[],
  };
}
