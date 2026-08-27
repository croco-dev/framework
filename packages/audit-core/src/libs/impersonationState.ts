type ActiveImpersonationState = {
  readonly sessionId: string;
  readonly impersonatorId: string;
  readonly targetUserId: string;
  readonly reason?: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
};

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getDateTimestamp(value: unknown): number | null {
  if (!(value instanceof Date)) {
    return null;
  }

  const timestamp = Date.prototype.getTime.call(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function resolveActiveImpersonationState(value: unknown): ActiveImpersonationState | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  try {
    const nowTimestamp = Date.now();
    const state = value as Record<string, unknown>;
    const sessionId = state.sessionId;
    const impersonatorId = state.impersonatorId;
    const targetUserId = state.targetUserId;
    const reason = state.reason;
    const startedAtTimestamp = getDateTimestamp(state.startedAt);
    const expiresAtTimestamp = getDateTimestamp(state.expiresAt);

    if (
      !isNonBlankString(sessionId) ||
      !isNonBlankString(impersonatorId) ||
      !isNonBlankString(targetUserId) ||
      (reason !== undefined && typeof reason !== "string") ||
      startedAtTimestamp === null ||
      expiresAtTimestamp === null ||
      startedAtTimestamp > nowTimestamp ||
      startedAtTimestamp >= expiresAtTimestamp ||
      expiresAtTimestamp <= nowTimestamp
    ) {
      return null;
    }

    return {
      sessionId,
      impersonatorId,
      targetUserId,
      reason,
      startedAt: new Date(startedAtTimestamp),
      expiresAt: new Date(expiresAtTimestamp),
    };
  } catch {
    return null;
  }
}

export function resolveActiveImpersonationContext(
  context: unknown,
): ActiveImpersonationState | null {
  if (typeof context !== "object" || context === null) {
    return null;
  }

  try {
    return resolveActiveImpersonationState((context as Record<string, unknown>).impersonation);
  } catch {
    return null;
  }
}
