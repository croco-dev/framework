import { Client } from '@upstash/qstash';

export type QStashTaskRunnerOptions = {
  /**
   * QStash token for authentication.
   */
  token: string;
  /**
   * Destination URL where task webhooks are received.
   * This endpoint will receive the task execution requests.
   */
  destinationUrl: string;
  /**
   * Default delay in seconds before delivering the message.
   * @default undefined (no delay)
   */
  defaultDelay?: number;
  /**
   * Default headers to include in all requests.
   */
  defaultHeaders?: Record<string, string>;
};

/**
 * QStash-based TaskRunner implementation.
 *
 * Publishes tasks to QStash which will deliver them to the configured destination URL.
 * The task will be executed by a webhook receiver at that endpoint.
 */
export class QStashTaskRunner {
  private readonly client: Client;
  private readonly destinationUrl: string;
  private readonly defaultDelay?: number;
  private readonly defaultHeaders?: Record<string, string>;

  constructor(options: QStashTaskRunnerOptions) {
    this.client = new Client({ token: options.token });
    this.destinationUrl = options.destinationUrl;
    this.defaultDelay = options.defaultDelay;
    this.defaultHeaders = options.defaultHeaders;
  }

  /**
   * Execute a task by publishing it to QStash.
   *
   * @param taskId - The unique identifier of the task to execute
   * @param payload - The payload to pass to the task handler
   * @param options - Optional execution options
   * @returns The QStash message ID
   */
  async execute(
    taskId: string,
    payload: unknown,
    options?: {
      /**
       * Delay in seconds before delivering the message.
       * Overrides the defaultDelay if provided.
       */
      delay?: number;
      /**
       * Additional headers to include in this request.
       * Merged with defaultHeaders.
       */
      headers?: Record<string, string>;
    }
  ): Promise<{ messageId: string }> {
    const delay = options?.delay ?? this.defaultDelay;
    const headers = { ...this.defaultHeaders, ...options?.headers };

    const response = await this.client.publishJSON({
      url: this.destinationUrl,
      body: {
        taskId,
        payload,
      },
      delay,
      headers,
    });

    return { messageId: response.messageId };
  }
}
