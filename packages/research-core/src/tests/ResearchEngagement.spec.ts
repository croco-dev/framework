import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  EngagementService,
  InMemoryRecipientDirectory,
  defineMessage,
  MessageRendererRegistry,
  InMemoryMessageRendererResolver,
  RegistryEngagementMessageRenderer,
  Renders,
} from "@croco/engagement-core";
import { createResearchEngagementSender } from "../index";
import { access, candidates, command, scope, study } from "./researchFixtures";
import { InMemoryResearchStore, ResearchService } from "../index";
const message = defineMessage({
  id: "research-invite",
  topic: "research",
  data: z.object({ bookingUrl: z.string() }),
  channels: ["email"],
});
describe("Research engagement integration", () => {
  it("uses actual EngagementService recipient and preference admission, preserving the immutable logical invitation key", async () => {
    const dispatch = vi.fn(async () => ({ executionId: "logical-execution" }));
    @Renders(message)
    class Renderer {
      email() {
        return {
          subject: "Research invitation",
          html: "<p>Synthetic invitation</p>",
          text: "Synthetic invitation",
        };
      }
    }
    const registry = new MessageRendererRegistry();
    registry.registerMessage(message);
    registry.registerRenderer(Renderer);
    registry.bootstrap();
    const resolver = new InMemoryMessageRendererResolver();
    resolver.register(message, new Renderer());
    const render = new RegistryEngagementMessageRenderer(registry, resolver);
    const directory = new InMemoryRecipientDirectory(
      candidates().map((candidate) => ({
        recipient: { tenantId: scope.tenantId, userId: candidate.subject },
        email: { id: candidate.subject, address: "synthetic@example.invalid" },
        push: [],
      })),
    );
    let denied = true;
    const engagement = new EngagementService(
      directory,
      render,
      { prepareDispatch: () => ({ dispatch }) },
      { evaluate: async () => ({ suppressed: denied, kind: "preference" }) },
    );
    const sender = createResearchEngagementSender(engagement, message, async (definition) => ({
      bookingUrl: definition.bookingUrl,
    }));
    const store = new InMemoryResearchStore();
    const service = new ResearchService(store, { authorize: async () => true }, sender, [
      study.bookingUrl,
    ]);
    await service.publishStudy(scope, study, access, command(0, "publish"));
    await service.importCandidates(scope, study.id, candidates(), access, command(1, "import"));
    await service.selectCandidates(scope, study.id, access, command(2, "select"));
    const first = (await store.read(scope, study.id)).invitations[0];
    await service.invite(scope, study.id, first.subject, access, command(3, "invite"));
    expect(dispatch).not.toHaveBeenCalled();
    expect((await store.read(scope, study.id)).invitations[0]).toMatchObject({
      state: "suppressed",
      failureCode: "preference",
    });
    denied = false;
    const second = (await store.read(scope, study.id)).invitations[1];
    await service.invite(scope, study.id, second.subject, access, command(5, "invite-second"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect((await store.read(scope, study.id)).invitations[1]).toMatchObject({
      state: "invited",
      executionIds: ["logical-execution"],
    });
    const serialized = JSON.stringify(dispatch.mock.calls);
    expect(serialized).toContain("research-invite");
    expect(serialized).toContain("tenant");
    const calls = JSON.parse(serialized) as [unknown, { idempotencyKey: string }][];
    expect(calls[0][1].idempotencyKey.split(":").map(decodeURIComponent)[5]).toBe(second.id);
    await service.invite(scope, study.id, second.subject, access, command(5, "invite-second"));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
