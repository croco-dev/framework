export type SurveyScope = Readonly<{ tenantId: string; appId: string; environmentId: string }>;
export type SurveySubject = Readonly<{ kind: "member" | "anonymous"; id: string }>;
export type SurveyQuestion = Readonly<
  {
    id: string;
    title: string;
    required: boolean;
  } & (
    | { kind: "single"; options: readonly Readonly<{ id: string; label: string }>[] }
    | { kind: "multi"; options: readonly Readonly<{ id: string; label: string }>[] }
    | { kind: "scale"; min: number; max: number }
    | { kind: "text"; maxLength: number }
  )
>;
export type SurveyDefinition = Readonly<{
  id: string;
  version: string;
  title: string;
  questions: readonly SurveyQuestion[];
  startsAt: string;
  endsAt: string;
  eligibility: string;
  trigger: string;
  frequencyPolicy: Readonly<{ maxInvitations: number; windowMs: number }>;
  allowEdits: boolean;
  retentionMs: number;
}>;
export type SurveyAnswers = Readonly<Record<string, string | readonly string[] | number>>;
export type SurveyPublication = Readonly<{
  definition: SurveyDefinition;
  revision: number;
  actor: string;
  reason: string;
  idempotencyKey: string;
  publishedAt: string;
}>;
export type SurveyInvitation = Readonly<{
  id: string;
  familyId: string;
  surveyVersion: string;
  subject: SurveySubject;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  shownAt?: string;
  dismissedAt?: string;
  submittedAt?: string;
}>;
export type SurveyResponse = Readonly<{
  id: string;
  invitationId: string;
  familyId: string;
  answers: SurveyAnswers;
  submittedAt: string;
  revision: number;
  idempotencyKey: string;
  classification?: string;
  deletedAt?: string;
}>;
export type SurveyPermission = "publish" | "read" | "raw" | "delete" | "classify";
export interface SurveyAuthority {
  authorize(input: {
    scope: SurveyScope;
    actor: string;
    permission: SurveyPermission;
  }): Promise<boolean>;
  verifySubject(input: {
    scope: SurveyScope;
    actor: string;
    subject: SurveySubject;
  }): Promise<boolean>;
}
export interface SurveyTokenCodec {
  create(): { raw: string; hash: string };
  hash(raw: string): string;
}
export type SurveyRecord =
  | { kind: "definition"; id: string; familyId: string; value: SurveyPublication }
  | { kind: "invitation"; id: string; familyId: string; value: SurveyInvitation }
  | { kind: "response"; id: string; familyId: string; value: SurveyResponse }
  | {
      kind: "audit";
      id: string;
      familyId: string;
      value: {
        actor: string;
        reason: string;
        operation: string;
        at: string;
        idempotencyKey: string;
        revision: number;
      };
    };
export interface SurveySession {
  get(kind: SurveyRecord["kind"], id: string): Promise<SurveyRecord | null>;
  put(record: SurveyRecord): Promise<void>;
  eraseAnswers(invitationId: string, at: string): Promise<void>;
  latest(familyId: string): Promise<SurveyPublication | null>;
  invitations(familyId: string, subject: SurveySubject, since: string): Promise<number>;
  counts(
    familyId: string,
  ): Promise<{ invitations: number; exposures: number; dismissed: number; submitted: number }>;
  responses(familyId: string, after: string, limit: number): Promise<readonly SurveyResponse[]>;
}
/** Implementations serialize a scope and roll back the whole callback on failure. */
export interface SurveyStore {
  transaction<T>(scope: SurveyScope, callback: (session: SurveySession) => Promise<T>): Promise<T>;
}
export type SurveyTargeting = Readonly<
  Record<string, (input: { scope: SurveyScope; subject: SurveySubject }) => Promise<boolean>>
>;
