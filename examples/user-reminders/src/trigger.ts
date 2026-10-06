import "reflect-metadata";
import { Cron } from "@croco/triggers-core";
import type { ReminderAccess, ReminderService } from "@croco/engagement-core";

/** An existing trigger host invokes this bridge; the application owns its verified subject inventory. */
export class ReminderDueTrigger {
  constructor(
    private readonly reminders: ReminderService,
    private readonly subjects: () => Promise<readonly ReminderAccess[]>,
  ) {}

  @Cron("* * * * *", { name: "user-reminders", timezone: "UTC" })
  async tick(): Promise<void> {
    for (const access of await this.subjects()) await this.reminders.runDue(access);
  }
}
