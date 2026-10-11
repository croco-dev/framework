import { describe, expect, it } from "vitest";
import { DomainEvent, RegisterEventHandler } from "@croco/events-core";
import { createEventTestingHarness } from "../index";

import type { EventHandler } from "@croco/events-core";

class UserCreatedEvent extends DomainEvent {
  static eventName = "testing.module-scope.user.created";

  constructor(readonly userId: string) {
    super();
  }
}

const received: string[] = [];

@RegisterEventHandler(UserCreatedEvent)
class CaptureUserCreatedHandler implements EventHandler<UserCreatedEvent> {
  handle(event: UserCreatedEvent): void {
    received.push(event.userId);
  }
}

async function dispatchOnce(userId: string): Promise<void> {
  const harness = await createEventTestingHarness<UserCreatedEvent>({
    handlers: [CaptureUserCreatedHandler],
    providers: [{ token: CaptureUserCreatedHandler, useValue: new CaptureUserCreatedHandler() }],
  });
  await harness.dispatch(new UserCreatedEvent(userId));
}

describe("createEventTestingHarness with a module-scope decorated handler", () => {
  it("delivers the event in the first harness", async () => {
    received.length = 0;
    await dispatchOnce("user-1");
    expect(received).toEqual(["user-1"]);
  });

  it("delivers the event in a second harness created by the next test", async () => {
    received.length = 0;
    await dispatchOnce("user-2");
    expect(received).toEqual(["user-2"]);
  });
});
