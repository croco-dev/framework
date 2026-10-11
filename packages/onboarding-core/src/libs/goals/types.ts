export type GoalScope = {
  tenantId: string;
  appId: string;
  environmentId: string;
};

export type GoalSubject = {
  id: string;
  verified: true;
};

export type GoalCountMode = "events" | "distinct_objects" | "distinct_calendar_days";
export type GoalAnchor = "signup" | "first_visit" | "return";
export type GoalDeletedObjectPolicy = "retain" | "retract";
export type GoalEpisodeStatus = "in_progress" | "closing" | "achieved" | "expired" | "canceled";

export type GoalGuidanceStep = {
  id: string;
  title: string;
  description?: string;
  href?: string;
};

export type GoalDefinition = {
  id: string;
  version: string;
  anchor: GoalAnchor;
  actionId: string;
  windowMs: number;
  allowedLatenessMs: number;
  timezone: string;
  countMode: GoalCountMode;
  threshold: number;
  deletedObjectPolicy: GoalDeletedObjectPolicy;
  title?: string;
  description?: string;
  nextActionHref?: string;
  guidanceSteps?: readonly GoalGuidanceStep[];
};

export type GoalDefinitionPublication = {
  scope: GoalScope;
  definition: GoalDefinition;
  revision: number;
  actorId: string;
  reason: string;
  idempotencyKey: string;
  publishedAt: Date;
};

export type GoalEpisodeKey = {
  scope: GoalScope;
  subject: GoalSubject;
  episodeId: string;
};

export type GoalEpisode = {
  id: string;
  scope: GoalScope;
  subject: GoalSubject;
  definitionId: string;
  definitionVersion: string;
  actionId: string;
  startedAt: Date;
  endsAt: Date;
  allowedLatenessMs: number;
  timezone: string;
  countMode: GoalCountMode;
  threshold: number;
  deletedObjectPolicy: GoalDeletedObjectPolicy;
  progress: number;
  status: GoalEpisodeStatus;
  achievedAt?: Date;
};

export type ActionReceipt = {
  eventId: string;
  actionId: string;
  objectId?: string;
  occurredAt: Date;
  confirmation: {
    source: "server";
    evidenceId: string;
  };
};

export type GoalCorrection = {
  eventId: string;
  actionId: string;
  occurredAt: Date;
  confirmation: ActionReceipt["confirmation"];
  correction:
    | { kind: "retract_event"; targetEventId: string }
    | { kind: "delete_object"; objectId: string };
};

export type GoalEvidence = ActionReceipt | GoalCorrection;

export type GoalAchievedEventIntent = {
  id: string;
  episodeId: string;
  scope: GoalScope;
  subject: GoalSubject;
  definitionId: string;
  definitionVersion: string;
  achievedAt: Date;
};

export type GoalObservationResult = {
  status: "recorded" | "duplicate" | "late_correction";
  episode: GoalEpisode;
  achievedEvent?: GoalAchievedEventIntent;
};

export type GoalProgress = {
  episode: GoalEpisode;
  progress: number;
  threshold: number;
  remaining: number;
  status: GoalEpisodeStatus;
  nextActionHref?: string;
  title?: string;
  description?: string;
  guidanceSteps?: readonly GoalGuidanceStep[];
};
