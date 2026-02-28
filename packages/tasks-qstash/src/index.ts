/**
 * @packageDocumentation
 *
 * @croco/tasks-qstash
 *
 * QStash-based distributed task runner implementation
 *
 * Provides integration with Upstash QStash for reliable task execution.
 *
 * @example
 * ```typescript
 * import { QStashTaskRunner } from '@croco/tasks-qstash';
 *
 * const runner = new QStashTaskRunner({
 *   token: process.env.QSTASH_TOKEN!,
 *   apiUrl: process.env.QSTASH_URL!,
 * });
 *
 * await runner.enqueue('my-task', { foo: 'bar' });
 * ```
 */

/**
 * QStash task runner options
 *
 * Configuration options for initializing QStashTaskRunner.
 *
 * @example
 * ```typescript
 * const options: QStashTaskRunnerOptions = {
 *   token: 'qstash-token',
 *   apiUrl: 'https://qstash.upstash.io',
 * };
 * ```
 */
export type { QStashTaskRunnerOptions } from './libs/QStashTaskRunner';

/**
 * QStash-based task runner
 *
 * Distributed task runner using Upstash QStash for message delivery.
 * Enqueues tasks to QStash for reliable execution.
 *
 * @example
 * ```typescript
 * const runner = new QStashTaskRunner({
 *   token: process.env.QSTASH_TOKEN!,
 * });
 *
 * // Enqueue a task
 * await runner.enqueue('send-email', { to: 'user@example.com' });
 *
 * // Run with callback URL
 * await runner.enqueue('process-image', { url: '...' }, {
 *   callback: 'https://api.example.com/callback',
 * });
 * ```
 */
export { QStashTaskRunner } from './libs/QStashTaskRunner';
