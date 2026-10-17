import "reflect-metadata";
import { context, createContextKey } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { installTestingTelemetryCapture } from "../index";

// Exercise the private manager through the installed OpenTelemetry context API.
describe("TestingContextManager", () => {
  it.each(["call", "apply", "method"] as const)(
    "preserves the receiver, arguments and bound telemetry context on %s invocation",
    (invocation) => {
      installTestingTelemetryCapture();
      const key = createContextKey("bound-callback");
      const callerContext = context.active().setValue(key, "caller");
      const boundContext = context.active().setValue(key, "bound");
      const receiver = { value: 42 };
      const otherReceiver = { value: 17 };
      function read(this: typeof receiver, first: string, second: number) {
        return { receiver: this, value: this.value, first, second, context: context.active() };
      }
      const bound = context.bind(boundContext, read);
      const methodReceiver = { ...receiver, read: bound };

      context.with(callerContext, () => {
        const result =
          invocation === "call"
            ? bound.call(receiver, "first", 9)
            : invocation === "apply"
              ? bound.apply(receiver, ["first", 9])
              : methodReceiver.read("first", 9);
        expect(result.receiver).toBe(invocation === "method" ? methodReceiver : receiver);
        expect(result).toEqual({
          receiver: invocation === "method" ? methodReceiver : receiver,
          value: 42,
          first: "first",
          second: 9,
          context: boundContext,
        });
        expect(bound.call(otherReceiver, "second", 3)).toEqual({
          receiver: otherReceiver,
          value: 17,
          first: "second",
          second: 3,
          context: boundContext,
        });
        expect(context.active()).toBe(callerContext);
      });
    },
  );

  it("preserves arrow callback results and telemetry context across asynchronous work", async () => {
    installTestingTelemetryCapture();
    const callerContext = context.active();
    const boundContext = callerContext.setValue(createContextKey("async-bound-callback"), "bound");
    const owner = {
      value: 42,
      bindRead() {
        return context.bind(boundContext, async (increment: number) => {
          await Promise.resolve();
          expect(context.active()).toBe(boundContext);
          return this.value + increment;
        });
      },
    };
    const bound = owner.bindRead();

    await expect(bound.call({ value: 17 }, 9)).resolves.toBe(51);
    expect(context.active()).toBe(callerContext);
  });

  it("propagates the original bound callback exception and restores the caller context", () => {
    installTestingTelemetryCapture();
    const callerContext = context.active();
    const boundContext = callerContext.setValue(
      createContextKey("throwing-bound-callback"),
      "bound",
    );
    const failure = new TypeError("callback failure");
    const bound = context.bind(boundContext, () => {
      expect(context.active()).toBe(boundContext);
      throw failure;
    });

    expect(bound).toThrow(failure);
    expect(context.active()).toBe(callerContext);
    const target = { value: 42 };
    expect(context.bind(boundContext, target)).toBe(target);
  });
});
