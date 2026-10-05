import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReminderSettingsForm, SnoozeControl } from "../libs/ReminderSettingsForm";
import type { ReminderSettingsSource } from "../libs/ReminderSettingsForm";

describe("Reminder settings", () => {
  it("renders a loading state without invoking mutations during render", () => {
    const source: ReminderSettingsSource = {
      load: vi.fn(),
      preview: vi.fn(),
      save: vi.fn(),
      snooze: vi.fn(),
      cancel: vi.fn(),
    };
    const html = renderToString(
      createElement(ReminderSettingsForm, {
        scopeKey: "owner",
        channels: ["email"],
        source,
        initialInput: {
          topic: "task",
          resourceRef: "task-1",
          timezone: "Asia/Seoul",
          schedule: { localTime: "09:00", weekdays: [1] },
          channel: "email",
          lateDeliveryMs: 0,
        },
      }),
    );
    expect(html).toContain("Loading reminders");
    expect(html).not.toContain("Create reminder");
    expect(source.save).not.toHaveBeenCalled();
    expect(source.load).not.toHaveBeenCalled();
  });
  it("requires an explicit snooze timestamp and explains one-shot semantics", () => {
    const onSnooze = vi.fn();
    const html = renderToString(createElement(SnoozeControl, { disabled: false, onSnooze }));
    expect(html).toContain("UTC ISO timestamp");
    expect(html).toContain("recurring schedule resumes");
    expect(html).toMatch(/button[^>]+disabled/);
    expect(onSnooze).not.toHaveBeenCalled();
  });
});
