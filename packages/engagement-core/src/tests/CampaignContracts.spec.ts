import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  Audience,
  AudienceAlreadyRegisteredProblem,
  AudienceDefinitionInvalidProblem,
  AudienceMetadataMissingProblem,
  AudienceNotRegisteredProblem,
  AudiencePreviewInvalidProblem,
  AudienceRegistry,
  AudienceScopeInvalidProblem,
  CampaignAlreadyRegisteredProblem,
  CampaignDefinitionInvalidProblem,
  CampaignNotRegisteredProblem,
  CampaignRegistry,
  defineCampaign,
  getAudienceDescriptor,
  type AudienceContext,
  type AudienceSource,
} from "../libs/CampaignContracts";
import { defineMessage } from "../libs/MessageContracts";

type Member = Readonly<{ userId: string; firstName: string }>;

const Welcome = defineMessage({
  id: "welcome",
  topic: "accounts",
  data: z.object({ firstName: z.string() }).strict(),
  channels: ["email"],
});

@Audience("new-members")
class NewMembers implements AudienceSource<Member> {
  returned = false;
  requested = 0;

  async *members(_context: AudienceContext): AsyncIterable<Member> {
    try {
      for (let index = 0; index < 10; index += 1) {
        this.requested += 1;
        yield { userId: `user-${index}`, firstName: `Member ${index}` };
      }
    } finally {
      this.returned = true;
    }
  }
}

const WelcomeCampaign = defineCampaign({
  id: "welcome-campaign",
  version: "1.0.0",
  audience: NewMembers,
  message: Welcome,
  map: (member) => ({
    recipient: { tenantId: "tenant-1", userId: member.userId },
    data: { firstName: member.firstName },
    key: member.userId,
  }),
});

describe("CampaignContracts", () => {
  it("records frozen audience metadata without constructing or globally registering classes", () => {
    let constructions = 0;
    @Audience("unconstructed", { scope: "global" })
    class Unconstructed implements AudienceSource<never> {
      constructor() {
        constructions += 1;
      }

      async *members(): AsyncIterable<never> {}
    }

    expect(constructions).toBe(0);
    expect(getAudienceDescriptor(Unconstructed)).toEqual({ id: "unconstructed", scope: "global" });
    expect(Object.isFrozen(getAudienceDescriptor(Unconstructed))).toBe(true);
    expect(() => new AudienceRegistry().resolve(Unconstructed)).toThrow(
      AudienceNotRegisteredProblem,
    );
  });

  it("requires decorated, unique explicit audience bindings", () => {
    class Undecorated implements AudienceSource<never> {
      async *members(): AsyncIterable<never> {}
    }
    @Audience("new-members")
    class DuplicateMembers implements AudienceSource<never> {
      async *members(): AsyncIterable<never> {}
    }

    const registry = new AudienceRegistry();
    const members = new NewMembers();
    registry.register(NewMembers, members);

    expect(registry.resolve(NewMembers)).toBe(members);
    expect(registry.list()).toEqual([{ id: "new-members", scope: "tenant" }]);
    expect(() => registry.register(DuplicateMembers, new DuplicateMembers())).toThrow(
      AudienceAlreadyRegisteredProblem,
    );
    expect(() => registry.register(Undecorated, new Undecorated())).toThrow(
      AudienceMetadataMissingProblem,
    );
  });

  it("previews only the requested sample and closes enumeration at the bound", async () => {
    const source = new NewMembers();
    const registry = new AudienceRegistry();
    registry.register(NewMembers, source);

    await expect(registry.preview(NewMembers, { tenantId: "tenant-1" }, 3)).resolves.toEqual([
      { userId: "user-0", firstName: "Member 0" },
      { userId: "user-1", firstName: "Member 1" },
      { userId: "user-2", firstName: "Member 2" },
    ]);
    expect(source.requested).toBe(3);
    expect(source.returned).toBe(true);
  });

  it("closes audience enumeration when previewing a member fails", async () => {
    @Audience("failing-preview")
    class FailingPreview implements AudienceSource<Member> {
      returned = false;

      members(): AsyncIterable<Member> {
        const markReturned = () => {
          this.returned = true;
        };
        let requested = 0;
        return {
          [Symbol.asyncIterator](): AsyncIterator<Member> {
            return {
              async next() {
                requested += 1;
                if (requested === 1) {
                  return {
                    done: false,
                    value: { userId: "user-0", firstName: "Member 0" },
                  };
                }
                throw new Error("audience unavailable");
              },
              async return() {
                markReturned();
                return { done: true, value: undefined };
              },
            };
          },
        };
      }
    }

    const source = new FailingPreview();
    const registry = new AudienceRegistry();
    registry.register(FailingPreview, source);

    await expect(registry.preview(FailingPreview, { tenantId: "tenant-1" }, 3)).rejects.toThrow(
      "audience unavailable",
    );
    expect(source.returned).toBe(true);
  });

  it("enforces tenant scope while permitting an explicitly global audience", async () => {
    @Audience("global-members", { scope: "global" })
    class GlobalMembers implements AudienceSource<string> {
      async *members(): AsyncIterable<string> {
        yield "global";
      }
    }

    const registry = new AudienceRegistry();
    registry.register(NewMembers, new NewMembers());
    registry.register(GlobalMembers, new GlobalMembers());

    await expect(registry.preview(NewMembers, {}, 1)).rejects.toThrow(AudienceScopeInvalidProblem);
    await expect(registry.preview(NewMembers, { tenantId: "  " }, 1)).rejects.toThrow(
      AudienceScopeInvalidProblem,
    );
    await expect(registry.preview(GlobalMembers, {}, 1)).resolves.toEqual(["global"]);
  });

  it("rejects invalid decorator and preview input through Problems", async () => {
    expect(() => Audience(" ")(class {})).toThrow(AudienceDefinitionInvalidProblem);
    expect(() => Audience("invalid", { scope: "account" as never })(class {})).toThrow(
      AudienceDefinitionInvalidProblem,
    );

    const registry = new AudienceRegistry();
    registry.register(NewMembers, new NewMembers());
    for (const limit of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      await expect(registry.preview(NewMembers, { tenantId: "tenant-1" }, limit)).rejects.toThrow(
        AudiencePreviewInvalidProblem,
      );
    }
  });

  it("creates stable frozen campaign descriptors and explicit registry inspection", () => {
    const equivalent = defineCampaign({
      id: "welcome-campaign",
      version: "1.0.0",
      audience: NewMembers,
      message: Welcome,
      map: WelcomeCampaign.map,
    });
    const registry = new CampaignRegistry();
    registry.register(WelcomeCampaign);

    expect(WelcomeCampaign.descriptor).toEqual(equivalent.descriptor);
    expect(WelcomeCampaign.descriptor).toMatchObject({
      id: "welcome-campaign",
      audienceId: "new-members",
      audienceScope: "tenant",
      messageId: "welcome",
      version: "1.0.0",
    });
    expect(WelcomeCampaign.descriptor.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(Object.isFrozen(WelcomeCampaign)).toBe(true);
    expect(Object.isFrozen(WelcomeCampaign.descriptor)).toBe(true);
    expect(registry.resolve("welcome-campaign")).toBe(WelcomeCampaign);
    expect(registry.list()).toEqual([WelcomeCampaign.descriptor]);
    expect(() => registry.register(equivalent)).toThrow(CampaignAlreadyRegisteredProblem);
    expect(() => registry.resolve("missing")).toThrow(CampaignNotRegisteredProblem);
  });

  it("requires a non-empty campaign version and hashes version changes", () => {
    expect(() =>
      defineCampaign({
        id: "invalid-version",
        version: " ",
        audience: NewMembers,
        message: Welcome,
        map: WelcomeCampaign.map,
      }),
    ).toThrow(CampaignDefinitionInvalidProblem);

    const nextVersion = defineCampaign({
      id: "welcome-campaign",
      version: "2.0.0",
      audience: NewMembers,
      message: Welcome,
      map: WelcomeCampaign.map,
    });
    expect(nextVersion.descriptor.hash).not.toBe(WelcomeCampaign.descriptor.hash);
  });
});
