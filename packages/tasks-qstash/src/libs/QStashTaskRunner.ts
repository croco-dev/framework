import { Client } from "@upstash/qstash";

export type QStashTaskRunnerOptions = {
  /**
   * QStash 인증 토큰입니다.
   */
  token: string;
  /**
   * 태스크 웹훅을 수신할 목적지 URL입니다.
   */
  destinationUrl: string;
  /**
   * 메시지 전달 전 기본 지연 시간입니다.
   */
  defaultDelay?: number;
  /**
   * 모든 요청에 공통으로 포함할 기본 헤더입니다.
   */
  defaultHeaders?: Record<string, string>;
};

/**
 * QStash에 태스크 메시지를 발행하는 태스크 러너입니다.
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
   * 태스크 식별자와 페이로드를 QStash에 발행합니다.
   */
  async execute(
    taskId: string,
    payload: unknown,
    options?: {
      /**
       * 이번 요청에만 적용할 지연 시간입니다.
       */
      delay?: number;
      /**
       * 이번 요청에만 추가할 헤더입니다.
       */
      headers?: Record<string, string>;
    },
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
