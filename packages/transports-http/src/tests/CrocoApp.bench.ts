import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Controller, Get } from '@croco/protocols-rest';
import { bench, describe } from 'vitest';
import { createApp } from '../libs/CrocoApp';
import { ErrorHandler } from '../libs/ErrorHandler';
import { HealthCheckRegistry } from '../libs/HealthCheckRegistry';
import type { LambdaContext, LambdaEvent } from '../libs/types';

function setupDI() {
  Container.reset();
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as unknown as Logger;
  Container.set(Logger, logger);
  Container.set(ErrorHandler, new ErrorHandler(logger));
  Container.set(HealthCheckRegistry, new HealthCheckRegistry());
}

@Controller('/bench1')
class BenchController1 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench2')
class BenchController2 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench3')
class BenchController3 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench4')
class BenchController4 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench5')
class BenchController5 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench6')
class BenchController6 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench7')
class BenchController7 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench8')
class BenchController8 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench9')
class BenchController9 {
  @Get('/') handler() {
    return { ok: true };
  }
}

@Controller('/bench10')
class BenchController10 {
  @Get('/') handler() {
    return { ok: true };
  }
}

const controllers = [
  BenchController1,
  BenchController2,
  BenchController3,
  BenchController4,
  BenchController5,
  BenchController6,
  BenchController7,
  BenchController8,
  BenchController9,
  BenchController10,
];

describe('CrocoApp benchmarks', () => {
  describe('CrocoApp constructor', () => {
    bench(
      'Hono + DI lookup',
      () => {
        setupDI();
        createApp({ controllers: [BenchController1] });
      },
      { iterations: 50, warmupIterations: 5 }
    );
  });

  describe('CrocoApp lambdaHandler (10 controllers)', () => {
    bench(
      'boot() + handler creation',
      () => {
        setupDI();
        const app = createApp({ controllers });
        app.lambdaHandler();
      },
      { iterations: 30, warmupIterations: 3 }
    );
  });

  describe('CrocoApp full cold-start simulation', () => {
    const lambdaContext: LambdaContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'bench-function',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-2:123456789012:function:bench-function',
      logGroupName: '/aws/lambda/bench-function',
      logStreamName: '2026/03/17/[$LATEST]abcdef',
      memoryLimitInMB: '128',
      awsRequestId: 'req-bench',
      done: () => undefined,
      getRemainingTimeInMillis: () => 5000,
      fail: () => undefined,
      succeed: () => undefined,
    };

    const lambdaEvent: LambdaEvent = {
      version: '2.0',
      routeKey: '$default',
      rawPath: '/bench1/',
      rawQueryString: '',
      headers: {},
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-123',
        domainName: 'example.execute-api.ap-northeast-2.amazonaws.com',
        domainPrefix: 'example',
        http: {
          method: 'GET',
          path: '/bench1/',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'bench',
        },
        requestId: 'gateway-req-bench',
        routeKey: '$default',
        stage: '$default',
        time: '17/Mar/2026:12:00:00 +0000',
        timeEpoch: 1710676800000,
      },
      isBase64Encoded: false,
    };

    bench(
      'createApp → lambdaHandler → mock API Gateway v2 event',
      async () => {
        setupDI();
        const app = createApp({ controllers });
        const handler = app.lambdaHandler();
        await handler(lambdaEvent, lambdaContext);
      },
      { iterations: 20, warmupIterations: 3 }
    );
  });
});
