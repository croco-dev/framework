import { ReminderInvalidProblem } from "./ReminderContracts";
import type { Reminder, ReminderOccurrence } from "./ReminderContracts";
import type { EngagementService, EngagementSendResult } from "./EngagementService";
import type { AnyMessage, MessageDataInput } from "./MessageContracts";

export type ReminderMessageBinding<TMessage extends AnyMessage = AnyMessage> = Readonly<{
  message: TMessage;
  data(reminder: Reminder, occurrence: ReminderOccurrence): Promise<MessageDataInput<TMessage>>;
}>;

/** Uses the existing recipient/preference/notification path; each binding has one declared channel. */
export function createReminderEngagementSender(
  engagement: EngagementService,
  bindings: readonly ReminderMessageBinding[],
): (reminder: Reminder, occurrence: ReminderOccurrence) => Promise<EngagementSendResult> {
  const registered = new Map<string, ReminderMessageBinding>();
  for (const binding of bindings) {
    if (binding.message.channels.length !== 1)
      throw new ReminderInvalidProblem("Reminder messages must declare exactly one channel");
    const key = JSON.stringify([binding.message.topic, binding.message.channels[0]]);
    if (registered.has(key))
      throw new ReminderInvalidProblem("Reminder topic/channel bindings must be unique");
    registered.set(key, binding);
  }
  return async (reminder, occurrence) => {
    const binding = registered.get(JSON.stringify([reminder.topic, reminder.channel]));
    if (!binding)
      throw new ReminderInvalidProblem(
        "Reminder topic/channel is not registered by the application",
      );
    return engagement.send(binding.message, {
      recipient: { tenantId: reminder.scope.tenantId, userId: reminder.subject },
      key: occurrence.id,
      data: await binding.data(reminder, occurrence),
    });
  };
}
