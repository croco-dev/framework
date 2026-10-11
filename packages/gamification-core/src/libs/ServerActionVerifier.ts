import { missionKey } from "./MissionContracts";
import type {
  MissionAggregateKey,
  MissionEvidence,
  MissionEvidenceVerifier,
  MissionScope,
} from "./types";

export type MissionServerActionReceipt = MissionEvidence & {
  scope: MissionScope;
  subjectId: string;
  missionId: string;
  version: number;
  episodeId: string;
};
/** Implement against the server's durable domain-action ledger, never a client request body. */
export interface MissionServerActionLedger {
  find(input: {
    scope: MissionScope;
    subjectId: string;
    eventId: string;
  }): Promise<MissionServerActionReceipt | undefined>;
}
export class ServerActionVerifier implements MissionEvidenceVerifier {
  constructor(private readonly ledger: MissionServerActionLedger) {}
  async verify(input: { key: MissionAggregateKey; evidence: MissionEvidence }): Promise<boolean> {
    const receipt = await this.ledger.find({
      scope: input.key.scope,
      subjectId: input.key.subjectId,
      eventId: input.evidence.eventId,
    });
    if (!receipt) return false;
    const { scope, subjectId, missionId, version, episodeId, ...evidence } = receipt;
    return (
      missionId === input.key.missionId &&
      version === input.key.version &&
      episodeId === input.key.episodeId &&
      missionKey(scope) === missionKey(input.key.scope) &&
      subjectId === input.key.subjectId &&
      missionKey(evidence) === missionKey(input.evidence)
    );
  }
}
