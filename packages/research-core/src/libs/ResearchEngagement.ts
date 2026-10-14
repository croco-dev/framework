import { ResearchInvalidProblem } from "./ResearchContracts";
import type { EngagementService, AnyMessage, MessageDataInput } from "@croco/engagement-core";
import type {
  Invitation,
  ResearchScope,
  ResearchSender,
  StudyDefinition,
} from "./ResearchContracts";
/** The application supplies a durable EngagementService with notification idempotency and current preferences. */
export function createResearchEngagementSender<TMessage extends AnyMessage>(
  engagement: EngagementService,
  message: TMessage,
  data: (study: StudyDefinition, invitation: Invitation) => Promise<MessageDataInput<TMessage>>,
): ResearchSender {
  if (message.channels.length !== 1)
    throw new ResearchInvalidProblem("Research invitations require exactly one declared channel");
  return {
    async send(scope: ResearchScope, study: StudyDefinition, invitation: Invitation) {
      return engagement.send(message, {
        recipient: { tenantId: scope.tenantId, userId: invitation.subject },
        key: invitation.id,
        campaignId: study.id,
        data: await data(study, invitation),
      });
    },
  };
}
