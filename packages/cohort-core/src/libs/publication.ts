import type { AudienceContext, AudienceSource } from "@croco/engagement-core";
import type {
  CohortPrivacyReader,
  CohortPublication,
  CohortPublicationStore,
  CohortScope,
  CohortSnapshot,
} from "./contracts";
import {
  cohortContentHash,
  cohortTimestamp,
  CohortUnavailableProblem,
  sameCohortScope,
} from "./evaluation";

function snapshotTimestamp(value: string): number {
  try {
    return cohortTimestamp(value);
  } catch {
    throw new CohortUnavailableProblem("Snapshot timestamp is invalid");
  }
}

/** The store is an application-supplied trusted publication boundary, never a client payload. */
export class PublishedCohortReader {
  constructor(
    private readonly store: CohortPublicationStore,
    private readonly privacy: CohortPrivacyReader,
  ) {}

  async read(
    snapshotId: string,
    scope: CohortScope,
    subjectKind: string,
    now: Date,
  ): Promise<Readonly<{ snapshot: CohortSnapshot; subjectIds: readonly string[] }>> {
    const publication = await this.store.read(snapshotId);
    if (!publication || publication.withdrawn)
      throw new CohortUnavailableProblem("Snapshot is absent or withdrawn");
    const { snapshot, subjectIds } = publication;
    if (
      !Number.isFinite(now.getTime()) ||
      snapshot.snapshotId !== snapshotId ||
      snapshot.schemaVersion !== 1 ||
      !sameCohortScope(snapshot.scope, scope) ||
      snapshot.subjectKind !== subjectKind ||
      !snapshot.membershipRef ||
      !snapshot.definitionId ||
      !Number.isSafeInteger(snapshot.definitionVersion) ||
      snapshot.definitionVersion < 1 ||
      !Number.isSafeInteger(snapshot.publicationRevision) ||
      snapshot.publicationRevision < 1 ||
      snapshot.sourceSnapshotRefs.length === 0 ||
      !snapshot.privacyVersion
    )
      throw new CohortUnavailableProblem("Snapshot metadata mismatch");
    if (
      snapshotTimestamp(snapshot.asOf) > snapshotTimestamp(snapshot.generatedAt) ||
      snapshotTimestamp(snapshot.generatedAt) > now.getTime() ||
      snapshotTimestamp(snapshot.validUntil) <= now.getTime()
    )
      throw new CohortUnavailableProblem("Snapshot is not valid at the requested time");
    if (
      new Set(subjectIds).size !== subjectIds.length ||
      subjectIds.some((id) => !id) ||
      cohortContentHash(subjectIds) !== snapshot.contentHash
    )
      throw new CohortUnavailableProblem("Snapshot payload mismatch");
    if ((await this.privacy.currentVersion(scope)) !== snapshot.privacyVersion)
      throw new CohortUnavailableProblem("Privacy version changed");
    const allowed: string[] = [];
    for (const subjectId of [...subjectIds].sort()) {
      if (await this.privacy.isAllowed(scope, subjectId)) allowed.push(subjectId);
    }
    // A version change during privacy reads invalidates the complete read.
    if ((await this.privacy.currentVersion(scope)) !== snapshot.privacyVersion)
      throw new CohortUnavailableProblem("Privacy version changed during read");
    return { snapshot, subjectIds: allowed };
  }
}

export type CohortAudienceMember = Readonly<{ subjectId: string; cohortSnapshot: CohortSnapshot }>;
export class CohortAudienceSource implements AudienceSource<CohortAudienceMember> {
  constructor(
    private readonly reader: PublishedCohortReader,
    private readonly snapshotId: string,
    private readonly scope: CohortScope,
    private readonly subjectKind: string,
    private readonly now: () => Date,
  ) {}
  private assertContext(context: AudienceContext): void {
    if (!context.tenantId || context.tenantId !== this.scope.tenantId)
      throw new CohortUnavailableProblem("Audience tenant mismatch");
  }
  async *members(context: AudienceContext): AsyncIterable<CohortAudienceMember> {
    this.assertContext(context);
    const publication = await this.reader.read(
      this.snapshotId,
      this.scope,
      this.subjectKind,
      this.now(),
    );
    for (const subjectId of publication.subjectIds)
      yield { subjectId, cohortSnapshot: publication.snapshot };
  }
  async estimate(context: AudienceContext): Promise<number> {
    this.assertContext(context);
    return (await this.reader.read(this.snapshotId, this.scope, this.subjectKind, this.now()))
      .subjectIds.length;
  }
}
export function createCohortPublication(
  snapshot: CohortSnapshot,
  subjectIds: readonly string[],
): CohortPublication {
  if (
    cohortContentHash(subjectIds) !== snapshot.contentHash ||
    new Set(subjectIds).size !== subjectIds.length
  )
    throw new CohortUnavailableProblem("Snapshot payload mismatch");
  return { snapshot, subjectIds: [...subjectIds].sort(), withdrawn: false };
}
