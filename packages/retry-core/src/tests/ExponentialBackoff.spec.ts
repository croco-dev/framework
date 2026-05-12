import { describe, expect, it, vi } from "vitest";
import type { BackoffDependencies } from "../libs/BackoffPolicy";
import { ExponentialBackoff } from "../libs/BackoffPolicy";

describe("ExponentialBackoff", () => {
  describe("기본 동작", () => {
    it("초기 delay를 반환해야 한다 (attempt=0)", () => {
      const backoff = new ExponentialBackoff({ delay: 1000, jitter: false });
      expect(backoff.getDelay(0)).toBe(1000);
    });

    it("지수적으로 증가해야 한다 (jitter 없음)", () => {
      const backoff = new ExponentialBackoff({ delay: 1000, multiplier: 2, jitter: false });
      expect(backoff.getDelay(0)).toBe(1000); // 1000 * 2^0
      expect(backoff.getDelay(1)).toBe(2000); // 1000 * 2^1
      expect(backoff.getDelay(2)).toBe(4000); // 1000 * 2^2
      expect(backoff.getDelay(3)).toBe(8000); // 1000 * 2^3
    });
  });

  describe("delay=0일 때 동작", () => {
    it("delay=0이면 항상 0을 반환해야 한다", () => {
      const backoff = new ExponentialBackoff({ delay: 0, multiplier: 2, jitter: false });
      expect(backoff.getDelay(0)).toBe(0);
      expect(backoff.getDelay(1)).toBe(0);
      expect(backoff.getDelay(100)).toBe(0);
    });
  });

  describe("multiplier<=1일 때 선형/감소 백오프", () => {
    it("multiplier=1이면 고정 지연을 유지해야 한다", () => {
      const backoff = new ExponentialBackoff({ delay: 1000, multiplier: 1, jitter: false });
      expect(backoff.getDelay(0)).toBe(1000);
      expect(backoff.getDelay(1)).toBe(1000);
      expect(backoff.getDelay(10)).toBe(1000);
    });

    it("multiplier<1이면 감소하는 지연을 가져야 한다", () => {
      const backoff = new ExponentialBackoff({ delay: 1000, multiplier: 0.5, jitter: false });
      expect(backoff.getDelay(0)).toBe(1000); // 1000 * 0.5^0
      expect(backoff.getDelay(1)).toBe(500); // 1000 * 0.5^1
      expect(backoff.getDelay(2)).toBe(250); // 1000 * 0.5^2
      expect(backoff.getDelay(3)).toBe(125); // 1000 * 0.5^3
    });
  });

  describe("maxDelay 도달 후 유지", () => {
    it("maxDelay에 도달하면 더 이상 증가하지 않아야 한다", () => {
      const backoff = new ExponentialBackoff({
        delay: 1000,
        multiplier: 2,
        maxDelay: 3000,
        jitter: false,
      });
      expect(backoff.getDelay(0)).toBe(1000);
      expect(backoff.getDelay(1)).toBe(2000);
      expect(backoff.getDelay(2)).toBe(3000);
      expect(backoff.getDelay(3)).toBe(3000);
      expect(backoff.getDelay(10)).toBe(3000);
    });

    it("maxDelay보다 작은 초기 delay는 정상 동작해야 한다", () => {
      const backoff = new ExponentialBackoff({
        delay: 500,
        multiplier: 10,
        maxDelay: 2000,
        jitter: false,
      });
      expect(backoff.getDelay(0)).toBe(500);
      expect(backoff.getDelay(1)).toBe(2000);
      expect(backoff.getDelay(2)).toBe(2000);
    });
  });

  describe("attempt가 매우 클 때 overflow 방지", () => {
    it("매우 큰 attempt에서도 Infinity가 아니어야 한다", () => {
      const backoff = new ExponentialBackoff({ delay: 1000, multiplier: 2, jitter: false });
      const delay = backoff.getDelay(1000);
      expect(delay).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
      expect(delay).toBeGreaterThan(0);
    });

    it("maxDelay가 설정되면 큰 attempt에서도 capped되어야 한다", () => {
      const backoff = new ExponentialBackoff({
        delay: 1,
        multiplier: 2,
        maxDelay: 30000,
        jitter: false,
      });
      expect(backoff.getDelay(100)).toBe(30000);
      expect(backoff.getDelay(1000)).toBe(30000);
    });
  });

  describe("jitter 적용 시 범위 검증", () => {
    it("jitter가 활성화되면 [0, cap] 범위 내의 난수를 반환해야 한다", () => {
      const mockRandom = vi.fn();
      const deps: BackoffDependencies = { random: mockRandom };
      const backoff = new ExponentialBackoff({ delay: 1000, jitter: true }, deps);

      mockRandom.mockReturnValue(0);
      expect(backoff.getDelay(0)).toBe(0); // 0 * 1000

      mockRandom.mockReturnValue(0.5);
      expect(backoff.getDelay(0)).toBe(500); // 0.5 * 1000

      mockRandom.mockReturnValue(1);
      expect(backoff.getDelay(0)).toBe(1000); // 1 * 1000
    });

    it("jitter와 maxDelay 조합 시 올바르게 동작해야 한다", () => {
      const mockRandom = vi.fn(() => 0.5);
      const deps: BackoffDependencies = { random: mockRandom };
      const backoff = new ExponentialBackoff(
        { delay: 1000, multiplier: 2, maxDelay: 3000, jitter: true },
        deps,
      );

      // attempt=2: 1000 * 2^2 = 4000, capped to 3000
      // jitter: 3000 * 0.5 = 1500
      expect(backoff.getDelay(2)).toBe(1500);
    });
  });

  describe("wait() 함수 동작", () => {
    it("지정된 시간만큼 대기해야 한다", async () => {
      vi.useFakeTimers();
      const sleepSpy = vi.fn();
      const deps: BackoffDependencies = { sleep: sleepSpy };
      const backoff = new ExponentialBackoff({ delay: 1000, jitter: false }, deps);

      const promise = backoff.wait(2);
      expect(sleepSpy).toHaveBeenCalledWith(4000);

      await promise;
      vi.useRealTimers();
    });

    it("delay=0이면 즉시 반환해야 한다", async () => {
      const backoff = new ExponentialBackoff({ delay: 0 });
      const start = Date.now();
      await backoff.wait(0);
      const end = Date.now();
      expect(end - start).toBeLessThan(10);
    });
  });

  describe("reset() 함수 동작", () => {
    it("reset은 no-op이어야 한다 (stateless)", () => {
      const backoff = new ExponentialBackoff({ delay: 1000, jitter: false });
      expect(() => backoff.reset()).not.toThrow();
      expect(backoff.getDelay(0)).toBe(1000);
      backoff.reset();
      expect(backoff.getDelay(0)).toBe(1000);
    });
  });

  describe("의존성 주입을 통한 테스트", () => {
    it("커스텀 sleep 함수로 대체 가능해야 한다", async () => {
      const customSleep = vi.fn();
      const deps: BackoffDependencies = { sleep: customSleep };
      const backoff = new ExponentialBackoff({ delay: 1000, jitter: false }, deps);

      await backoff.wait(1);
      expect(customSleep).toHaveBeenCalledWith(2000);
    });

    it("커스텀 random 함수로 대체 가능해야 한다", () => {
      const customRandom = vi.fn(() => 0.25);
      const deps: BackoffDependencies = { random: customRandom };
      const backoff = new ExponentialBackoff({ delay: 1000, jitter: true }, deps);

      const delay = backoff.getDelay(0);
      expect(customRandom).toHaveBeenCalled();
      expect(delay).toBe(250); // 1000 * 0.25
    });
  });
});
