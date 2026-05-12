import { beforeEach, describe, expect, it } from "vitest";
import { Component, Container, Context } from "../index";

describe("request scoped container behavior", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should return same instance within same Context.run()", async () => {
    class RequestService {
      readonly id = Math.random();
    }

    Component({ scope: "request" })(RequestService);

    await Context.run({ requestId: "req-same-context" }, async () => {
      const instance1 = Container.get(RequestService);
      const instance2 = Container.get(RequestService);

      expect(instance1).toBe(instance2);
    });
  });

  it("should return different instances across different Context.run()", async () => {
    class RequestService {
      readonly id = Math.random();
    }

    Component({ scope: "request" })(RequestService);

    let firstRequestInstance!: RequestService;
    let secondRequestInstance!: RequestService;

    await Context.run({ requestId: "req-1" }, async () => {
      firstRequestInstance = Container.get(RequestService);
    });

    await Context.run({ requestId: "req-2" }, async () => {
      secondRequestInstance = Container.get(RequestService);
    });

    expect(firstRequestInstance).not.toBe(secondRequestInstance);
  });

  it("should preserve request scoped instance across async boundaries", async () => {
    class RequestService {
      readonly id = Math.random();
    }

    Component({ scope: "request" })(RequestService);

    await Context.run({ requestId: "req-async-boundary" }, async () => {
      const first = Container.get(RequestService);
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const second = Container.get(RequestService);

      expect(first).toBe(second);
    });
  });
});
