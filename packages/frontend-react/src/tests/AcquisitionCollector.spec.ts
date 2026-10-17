import { describe, expect, it, vi } from "vitest";
import {
  AcquisitionCollectorProblem,
  collectAcquisitionContext,
} from "../libs/acquisitionCollector";

describe("first-party acquisition collector", () => {
  it("does nothing before application consent", async () => {
    const parse = vi.fn();
    const send = vi.fn();
    const replace = vi.fn();
    expect(
      await collectAcquisitionContext({
        enabled: false,
        location: { href: "secret", referrer: "", replace },
        parse,
        send,
        cleanPath: "/",
      }),
    ).toBe("disabled");
    expect(parse).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
  it("clears raw query and fragment before sending only parsed context", async () => {
    const events: string[] = [];
    await collectAcquisitionContext({
      enabled: true,
      location: {
        href: "https://shop.test/?token=secret#email",
        referrer: "",
        replace(path) {
          events.push(path);
        },
      },
      cleanPath: "/",
      parse: () => ({ landingRef: "home" }),
      send: async (context) => {
        expect(context).toEqual({ landingRef: "home" });
        expect(events).toEqual(["/"]);
        events.push("sent");
      },
    });
    expect(events).toEqual(["/", "sent"]);
  });
  it("clears the address even if parsing fails, never sends failed input, and rejects arbitrary redirect paths", async () => {
    const send = vi.fn();
    const replace = vi.fn();
    await expect(
      collectAcquisitionContext({
        enabled: true,
        location: { href: "invalid", referrer: "", replace },
        cleanPath: "/",
        parse() {
          throw new AcquisitionCollectorProblem();
        },
        send,
      }),
    ).rejects.toBeInstanceOf(AcquisitionCollectorProblem);
    expect(replace).toHaveBeenCalledWith("/");
    expect(send).not.toHaveBeenCalled();
    await expect(
      collectAcquisitionContext({
        enabled: true,
        location: { href: "invalid", referrer: "", replace },
        cleanPath: "//evil.test",
        parse: () => ({}),
        send,
      }),
    ).rejects.toBeInstanceOf(AcquisitionCollectorProblem);
  });
});
