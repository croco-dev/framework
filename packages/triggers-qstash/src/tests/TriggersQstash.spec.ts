import { describe, expect, it } from 'vitest';

describe('@croco/triggers-qstash', () => {
  it('package exports should be available', async () => {
    const { QStashScheduler, QStashTriggerHandler } = await import('../index');

    expect(QStashScheduler).not.toBeUndefined();
    expect(QStashTriggerHandler).not.toBeUndefined();
  });
});
