import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  engagementCampaignMemberOutcomes,
  engagementCampaignSnapshotMembers,
  engagementCampaignSnapshots,
} from "../index";

describe("campaign Drizzle schema", () => {
  it("declares the snapshot, member, and outcome tables", () => {
    expect(
      [
        engagementCampaignSnapshots,
        engagementCampaignSnapshotMembers,
        engagementCampaignMemberOutcomes,
      ].map(getTableName),
    ).toEqual([
      "engagement_campaign_snapshots",
      "engagement_campaign_snapshot_members",
      "engagement_campaign_member_outcomes",
    ]);
  });
});
