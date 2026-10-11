import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { InMemorySagaStore, SagaRunner, type SagaDefinition } from "../index";

class ClockTestProblem extends Problem {
  constructor() {
    super("workflow-core/clock-test", ProblemCategory.InternalServerError, "Step failed");
  }
}

const instant = new Date("2001-02-03T04:05:06.000Z");
const clock = () => new Date(instant);

describe("workflow clocks", () => {
  it("uses the store clock for creation", async () => {
    const store = new InMemorySagaStore(clock);
    expect(await store.create({ sagaName: "clock", payload: {} })).toMatchObject({
      createdAt: instant,
    });
  });

  it("shares the runner clock with its default store and timestamps retries and published outbox", async () => {
    let now = instant;
    const stepCompletedAt = new Date("2001-02-03T04:06:06.000Z");
    const publishedAt = new Date("2001-02-03T04:07:06.000Z");
    const runner = new SagaRunner(undefined, () => new Date(now));
    const result = await runner.execute(
      {
        name: "clock-success",
        idempotencyKey: "one",
        outbox: {
          publish: () => {
            now = publishedAt;
          },
        },
        steps: [
          {
            id: "retry",
            retry: { maxAttempts: 2, shouldRetry: () => true },
            run: (_input, context) => {
              if (context.attempt === 1) throw new ClockTestProblem();
              now = stepCompletedAt;
              context.enqueueOutbox({ id: "done", topic: "done", payload: {} });
              return "done";
            },
          },
        ],
      },
      {},
    );
    const execution = await runner.getExecution(result.executionId);
    expect(execution).toMatchObject({
      status: "completed",
      createdAt: instant,
      startedAt: instant,
      completedAt: stepCompletedAt,
      metadata: {
        sagaInvocationId: expect.stringMatching(new RegExp(`^clock-success:${instant.getTime()}:`)),
      },
      steps: [
        {
          attempts: 2,
          startedAt: instant,
          completedAt: stepCompletedAt,
          outboxMessages: [
            { enqueuedAt: stepCompletedAt.toISOString(), publishedAt: publishedAt.toISOString() },
          ],
        },
      ],
    });
  });

  it.each([false, true])(
    "timestamps failure, compensation (fails: %s), and replay",
    async (compensationFails) => {
      let now = instant;
      const runner = new SagaRunner(undefined, () => new Date(now));
      const definition: SagaDefinition = {
        name: "clock-failure",
        outbox: { publish: () => {} },
        steps: [
          {
            id: "first",
            run: () => 1,
            compensate: (_input, context) => {
              if (compensationFails) throw new ClockTestProblem();
              context.enqueueOutbox({ id: "undo", topic: "undo", payload: {} });
            },
          },
          {
            id: "second",
            run: () => {
              throw new ClockTestProblem();
            },
          },
        ],
      };
      await expect(runner.execute(definition, {})).rejects.toThrow();
      const [failed] = await runner.listExecutions();
      expect(failed).toMatchObject({
        createdAt: instant,
        startedAt: instant,
        completedAt: instant,
        steps: [
          {
            startedAt: instant,
            completedAt: instant,
            compensationStartedAt: instant,
            compensationCompletedAt: instant,
          },
          { startedAt: instant, completedAt: instant },
        ],
      });
      if (!compensationFails)
        expect(failed.steps[0].outboxMessages).toEqual([
          expect.objectContaining({
            enqueuedAt: instant.toISOString(),
            publishedAt: instant.toISOString(),
          }),
        ]);
      now = new Date("2002-03-04T05:06:07.000Z");
      await expect(runner.replay(definition, failed.id)).rejects.toThrow();
      const [replayed] = await runner.listExecutions({ replayOf: failed.id });
      expect(replayed).toMatchObject({
        createdAt: now,
        startedAt: now,
        completedAt: now,
        metadata: { replayedAt: now.toISOString() },
      });
    },
  );
});
