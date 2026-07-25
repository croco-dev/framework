import { OutboundWebhookConfigurationProblem } from "./OutboundWebhookProblems";
import type {
  OutboundWebhookAttemptOutcome,
  OutboundWebhookTransport,
  OutboundWebhookTransportRequest,
} from "./types";

export class FakeOutboundWebhookTransport implements OutboundWebhookTransport {
  readonly requests: OutboundWebhookTransportRequest[] = [];
  private readonly outcomes: OutboundWebhookAttemptOutcome[];

  constructor(outcomes: readonly OutboundWebhookAttemptOutcome[]) {
    this.outcomes = [...outcomes];
  }

  async send(request: OutboundWebhookTransportRequest): Promise<OutboundWebhookAttemptOutcome> {
    this.requests.push({
      ...request,
      resolvedAddresses: [...request.resolvedAddresses],
      body: new Uint8Array(request.body),
      headers: { ...request.headers },
    });
    const outcome = this.outcomes.shift();
    if (!outcome) {
      throw new OutboundWebhookConfigurationProblem("fake transport outcome queue is empty");
    }
    return outcome;
  }
}
