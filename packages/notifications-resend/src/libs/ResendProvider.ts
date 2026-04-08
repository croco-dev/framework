import { randomUUID } from 'node:crypto';

import { Component } from '@croco/framework-context';
import {
  NotificationChannel,
  type NotificationPayload,
  type NotificationProvider,
  type NotificationResult,
} from '@croco/notifications-core';
import { type RetryPolicy, RetryTemplate } from '@croco/retry-core';
import { type CreateEmailOptions, type CreateEmailResponse, Resend } from 'resend';
import { ResendNotificationProblem } from './problems/ResendNotificationProblem';

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_NAMES = new Set([
  'application_error',
  'concurrent_idempotent_requests',
  'internal_server_error',
  'rate_limit_exceeded',
]);
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const RESEND_ERROR_STATUS_BY_NAME: Record<string, number> = {
  application_error: 500,
  concurrent_idempotent_requests: 409,
  internal_server_error: 500,
  invalid_api_key: 403,
  invalid_api_Key: 403,
  invalid_idempotent_request: 409,
  invalid_parameter: 400,
  invalid_region: 422,
  invalid_smtp_configuration: 422,
  not_found: 404,
  rate_limit_exceeded: 429,
};

type ResendError = Error & {
  code?: string;
  providerResponse?: CreateEmailResponse;
  retryAfter?: string;
  status?: number;
};

const RESEND_RETRY_POLICY: RetryPolicy = {
  shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    return isRetryableResendError(error);
  },
};

function getErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const resendError = error as ResendError;
  if (resendError.status !== undefined) {
    return resendError.status;
  }

  return resendError.code ? RESEND_ERROR_STATUS_BY_NAME[resendError.code] : undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return (error as ResendError).code;
}

function normalizeResendError(
  error: unknown,
  fallbackMessage: string,
  providerResponse?: CreateEmailResponse
): ResendError {
  if (error instanceof Error) {
    const resendError = error as ResendError;

    if (resendError.code && resendError.status === undefined) {
      resendError.status = RESEND_ERROR_STATUS_BY_NAME[resendError.code];
    }

    if (providerResponse) {
      resendError.providerResponse = providerResponse;
    }

    return resendError;
  }

  const errorRecord = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : undefined;
  const message = typeof errorRecord?.message === 'string' ? errorRecord.message : fallbackMessage;
  const resendError = new Error(message) as ResendError;

  if (typeof errorRecord?.name === 'string') {
    resendError.code = errorRecord.name;
  }

  if (typeof errorRecord?.statusCode === 'number') {
    resendError.status = errorRecord.statusCode;
  } else if (typeof errorRecord?.status === 'number') {
    resendError.status = errorRecord.status;
  } else if (typeof errorRecord?.name === 'string') {
    resendError.status = RESEND_ERROR_STATUS_BY_NAME[errorRecord.name];
  }

  if (typeof errorRecord?.retryAfter === 'string') {
    resendError.retryAfter = errorRecord.retryAfter;
  }

  if (providerResponse) {
    resendError.providerResponse = providerResponse;
  }

  return resendError;
}

function isRetryableResendError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code !== undefined && TRANSIENT_ERROR_NAMES.has(code)) {
    return true;
  }

  const status = getErrorStatus(error);
  if (status !== undefined && TRANSIENT_HTTP_STATUSES.has(status)) {
    return true;
  }

  if (code === undefined) {
    return false;
  }

  return TRANSIENT_ERROR_CODES.has(code);
}

export interface ResendConfig {
  apiKey: string;
  from: string;
}

@Component()
export class ResendProvider implements NotificationProvider {
  private client: Resend;
  private readonly retryTemplate = new RetryTemplate({
    maxAttempts: 3,
    backoff: {
      delay: 10,
      multiplier: 2,
      maxDelay: 50,
      jitter: false,
    },
    retryPolicy: RESEND_RETRY_POLICY,
  });

  constructor(private config: ResendConfig) {
    this.client = new Resend(config.apiKey);
  }

  getName(): string {
    return 'resend';
  }

  getChannel(): NotificationChannel {
    return NotificationChannel.EMAIL;
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const { to, subject, content, templateId, variables } = payload;
      const idempotencyKey = `resend-${randomUUID()}`;

      const emailOptions: CreateEmailOptions = {
        from: this.config.from,
        to,
      };

      if (subject) {
        emailOptions.subject = subject;
      }

      if (templateId && variables) {
        emailOptions.template = {
          id: templateId,
          variables: variables as Record<string, string | number>,
        };
      } else {
        emailOptions.subject = subject || 'No Subject';
        emailOptions.html = content;
      }

      const data = await this.retryTemplate.execute(async () => {
        const response = await this.client.emails.send(emailOptions, { idempotencyKey });

        if (response.error) {
          const resendError = normalizeResendError(response.error, response.error.message, response);

          if (isRetryableResendError(resendError)) {
            throw resendError;
          }
        }

        return response;
      });

      if (data.error) {
        return {
          success: false,
          error: new ResendNotificationProblem(data.error.message),
          providerResponse: data,
        };
      }

      return {
        success: true,
        messageId: data.data?.id,
        providerResponse: data,
      };
    } catch (error: unknown) {
      const cause = normalizeResendError(error, 'Unknown Resend error');

      return {
        success: false,
        error: new ResendNotificationProblem(cause.message, cause),
        providerResponse: cause.providerResponse,
      };
    }
  }

  async sendBatch(payloads: NotificationPayload[]): Promise<NotificationResult[]> {
    return Promise.all(payloads.map((payload) => this.send(payload)));
  }
}
