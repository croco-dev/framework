import { Problem, ProblemCategory } from '@croco/problems-core';
import { Receiver } from '@upstash/qstash';
import type { Context, MiddlewareHandler, Next } from 'hono';

export class QStashSignatureInvalidProblem extends Problem {
  readonly code = 'QSTASH_SIGNATURE_INVALID';
  readonly category = ProblemCategory.Unauthorized;

  constructor() {
    super('QSTASH_SIGNATURE_INVALID', ProblemCategory.Unauthorized, 'Invalid QStash signature');
  }
}

export type QStashReceiverOptions = {
  currentSigningKey: string;
  nextSigningKey: string;
};

export class QStashReceiver {
  private readonly receiver: Receiver;

  constructor(options: QStashReceiverOptions) {
    this.receiver = new Receiver({
      currentSigningKey: options.currentSigningKey,
      nextSigningKey: options.nextSigningKey,
    });
  }

  async verify(signature: string, body: string): Promise<boolean> {
    try {
      return await this.receiver.verify({
        signature,
        body,
      });
    } catch {
      return false;
    }
  }
}

export function createQStashMiddleware(options: QStashReceiverOptions): MiddlewareHandler {
  const receiver = new QStashReceiver(options);

  return async (c: Context, next: Next) => {
    const signature = c.req.header('upstash-signature');
    if (!signature) {
      throw new QStashSignatureInvalidProblem();
    }

    const body = await c.req.text();
    const isValid = await receiver.verify(signature, body);

    if (!isValid) {
      throw new QStashSignatureInvalidProblem();
    }

    // body를 다시 읽을 수 있도록 설정
    // Hono에서는 raw body를 context에 저장
    c.set('qstashBody', body);
    c.set('qstashPayload', JSON.parse(body));

    await next();
  };
}
