import { describe, expect, it, vi } from "vitest";
import { ExponentialBackoff, FixedBackoff, NoBackoff } from "../libs/BackoffPolicy";

describe("ExponentialBackoff", () => {
  it("calculates exponential delay without jitter", () => {
    const backoff = new ExponentialBackoff(
      { delay: 100, multiplier: 2, jitter: false },
      { random: () => 0.5 },
    );

    expect(backoff.getDelay(0)).toBe(100); // 100 * 2^0 = 100
    expect(backoff.getDelay(1)).toBe(200); // 100 * 2^1 = 200
    expect(backoff.getDelay(2)).toBe(400); // 100 * 2^2 = 400
  });

  it("respects maxDelay cap", () => {
    const backoff = new ExponentialBackoff({
      delay: 100,
      multiplier: 2,
      maxDelay: 300,
      jitter: false,
    });

    expect(backoff.getDelay(5)).toBe(300); // capped at maxDelay
  });

  it("applies full jitter", () => {
    const backoff = new ExponentialBackoff(
      { delay: 100, multiplier: 2, jitter: true },
      { random: () => 0.5 },
    );

    // With jitter: random(0, cap) where cap = 100
    // random() = 0.5, so delay = 0.5 * 100 = 50
    expect(backoff.getDelay(0)).toBe(50);
  });

  it("waits for calculated delay", async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const backoff = new ExponentialBackoff({ delay: 100, jitter: false }, { sleep: sleepMock });

    await backoff.wait(0);

    expect(sleepMock).toHaveBeenCalledWith(100);
  });

  it("reuses the cached delay when wait follows getDelay", async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const backoff = new ExponentialBackoff(
      { delay: 100, multiplier: 2, jitter: false },
      { sleep: sleepMock },
    );
    const getDelaySpy = vi.spyOn(backoff, "getDelay");

    expect(backoff.getDelay(1)).toBe(200);
    await backoff.wait(1);

    expect(getDelaySpy).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(200);
  });
});

describe("FixedBackoff", () => {
  it("returns fixed delay", () => {
    const backoff = new FixedBackoff(500);
    expect(backoff.getDelay(0)).toBe(500);
    expect(backoff.getDelay(5)).toBe(500);
  });
});

describe("NoBackoff", () => {
  it("returns zero delay", () => {
    const backoff = new NoBackoff();
    expect(backoff.getDelay(0)).toBe(0);
  });
});
