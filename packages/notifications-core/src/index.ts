/**
 * @packageDocumentation
 *
 * @package @croco/notifications-core
 *
 * @description
 * Core package for multi-channel notification delivery with provider abstraction and async job processing.
 * Supports EMAIL, SMS, PUSH, SLACK, and IN_APP channels with extensible provider architecture.
 *
 * @example
 * ```typescript
 * import { NotificationService, NotificationChannel } from '@croco/notifications-core';
 *
 * // Register a provider as default for a channel
 * service.registerProvider(emailProvider, true);
 *
 * // Send notification via default provider
 * await service.send(NotificationChannel.EMAIL, {
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   content: '<h1>Hello!</h1>'
 * });
 * ```
 */

/**
 * NotificationService - Core service for notification management and provider registration.
 *
 * @description
 * Manages notification providers and orchestrates notification delivery through async job queue.
 * Supports provider registration, default provider assignment per channel, and multi-channel delivery.
 *
 * @example
 * ```typescript
 * @Service()
 * class MyService {
 *   constructor(private notificationService: NotificationService) {}
 *
 *   async notifyUser(userId: string) {
 *     await this.notificationService.send(
 *       NotificationChannel.EMAIL,
 *       { to: 'user@example.com', subject: 'Alert', content: 'Message' }
 *     );
 *   }
 * }
 * ```
 */
export * from './libs/NotificationService';
export * from './libs/problems/NotificationProblems';
/**
 * SendNotificationTask - Background task for async notification processing.
 *
 * @description
 * Job queue task that handles actual notification delivery with retry capability.
 * Registered as 'send-notification' task with configurable maxAttempts (default: 3) for resilient delivery.
 * Integrates with TaskRunner for background processing.
 *
 * @example
 * ```typescript
 * // Task is automatically registered via @Task decorator
 * // Manual execution example:
 * await taskRunner.execute('send-notification', {
 *   providerName: 'resend',
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   content: 'Hello World'
 * });
 * ```
 */
export * from './libs/SendNotificationTask';

/**
 * Type definitions for notification system.
 *
 * @description
 * Includes:
 * - {@link NotificationChannel}: Enum of supported channels (EMAIL, SMS, PUSH, SLACK, IN_APP)
 * - {@link NotificationPayload}: Input payload for sending notifications
 * - {@link NotificationResult}: Result from provider send operation
 * - {@link NotificationProvider}: Interface for implementing custom providers
 * - {@link NotificationJobPayload}: Internal job queue payload format
 *
 * @example
 * ```typescript
 * import { NotificationChannel, NotificationPayload } from '@croco/notifications-core';
 *
 * const payload: NotificationPayload = {
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   content: '<h1>Hello!</h1>',
 *   templateId: 'welcome-email',
 *   variables: { name: 'John' }
 * };
 * ```
 */
export * from './libs/types';
