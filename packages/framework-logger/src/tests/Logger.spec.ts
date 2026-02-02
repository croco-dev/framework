import { Container, Context } from '@croco/framework-context';
import pino, { type Logger as PinoLogger } from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../Logger';

vi.mock('pino', () => ({
  default: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(function (this: PinoLogger) {
      return this;
    }),
  })),
}));

describe('Logger', () => {
  let mockConfig: {
    isProduction: boolean;
    get: ReturnType<typeof vi.fn>;
  };
  let logger!: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    Container.reset();
    mockConfig = {
      isProduction: false,
      get: vi.fn((key: string) => {
        if (key === 'LOG_LEVEL') return 'info';
        return undefined;
      }),
    };
    logger = new Logger(mockConfig as any);
  });

  describe('로그 레벨 메서드', () => {
    it('debug 메서드가 pino.debug를 올바른 인자로 호출해야 함', () => {
      const debugSpy = vi.spyOn((logger as any).logger, 'debug');

      logger.debug('테스트 메시지', { key: 'value' });

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith(expect.objectContaining({ key: 'value' }), '테스트 메시지');
    });

    it('info 메서드가 pino.info를 올바른 인자로 호출해야 함', () => {
      const infoSpy = vi.spyOn((logger as any).logger, 'info');

      logger.info('정보 메시지', { userId: '123' });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: '123' }), '정보 메시지');
    });

    it('warn 메서드가 pino.warn를 올바른 인자로 호출해야 함', () => {
      const warnSpy = vi.spyOn((logger as any).logger, 'warn');

      logger.warn('경고 메시지', { threshold: 90 });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ threshold: 90 }), '경고 메시지');
    });

    it('error 메서드가 context 객체와 함께 pino.error를 호출해야 함', () => {
      const errorSpy = vi.spyOn((logger as any).logger, 'error');

      logger.error('에러 메시지', { code: 'INTERNAL_ERROR' });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }), '에러 메시지');
    });

    it('error 메서드가 Error 객체를 err 필드로 전달해야 함', () => {
      const errorSpy = vi.spyOn((logger as any).logger, 'error');
      const testError = new Error('테스트 에러');

      logger.error('에러 발생', testError);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          err: testError,
        }),
        '에러 발생'
      );
    });

    it('fatal 메서드가 Error 객체와 함께 pino.fatal을 호출해야 함', () => {
      const fatalSpy = vi.spyOn((logger as any).logger, 'fatal');
      const testError = new Error('치명적 에러');

      logger.fatal('치명적 오류', testError);

      expect(fatalSpy).toHaveBeenCalledTimes(1);
      expect(fatalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          err: testError,
        }),
        '치명적 오류'
      );
    });
  });

  describe('AsyncLocalStorage 기반 컨텍스트', () => {
    it('Context.run 내에서 로그에 requestId가 포함되어야 함', () => {
      const infoSpy = vi.spyOn((logger as any).logger, 'info');
      const testRequestId = 'req-test-123';

      Context.run({ requestId: testRequestId }, () => {
        logger.info('컨텍스트 테스트');
      });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: testRequestId,
        }),
        '컨텍스트 테스트'
      );
    });

    it('Context.run 외부에서는 requestId가 포함되지 않아야 함', () => {
      const debugSpy = vi.spyOn((logger as any).logger, 'debug');

      logger.debug('컨텍스트 없음');

      expect(debugSpy).toHaveBeenCalledTimes(1);
      const callArgs = debugSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.requestId).toBeUndefined();
    });

    it('여러 개의 독립적인 Context.run이 서로 격리되어야 함', () => {
      const infoSpy = vi.spyOn((logger as any).logger, 'info');
      const results: (string | null)[] = [];

      Context.run({ requestId: 'req-1' }, () => {
        logger.info('첫 번째 요청');
        results.push(Context.getRequestId());
      });

      Context.run({ requestId: 'req-2' }, () => {
        logger.info('두 번째 요청');
        results.push(Context.getRequestId());
      });

      expect(results).toEqual(['req-1', 'req-2']);
      expect(infoSpy).toHaveBeenCalledTimes(2);

      const firstCallArgs = infoSpy.mock.calls[0][0] as Record<string, unknown>;
      const secondCallArgs = infoSpy.mock.calls[1][0] as Record<string, unknown>;

      expect(firstCallArgs.requestId).toBe('req-1');
      expect(secondCallArgs.requestId).toBe('req-2');
    });

    it('수동 컨텍스트가 AsyncLocalStorage 컨텍스트보다 우선되어야 함', () => {
      const infoSpy = vi.spyOn((logger as any).logger, 'info');

      Context.run({ requestId: 'req-async' }, () => {
        logger.info('메시지', { requestId: 'req-manual' });
      });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-manual',
        }),
        '메시지'
      );
    });
  });

  describe('child() 메서드', () => {
    it('child()가 하위 로거를 생성해야 함', () => {
      const childSpy = vi.spyOn((logger as any).logger, 'child');
      const childLogger = logger.child({ module: 'TestModule', version: '1.0.0' });

      expect(childSpy).toHaveBeenCalledTimes(1);
      expect(childSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'TestModule',
          version: '1.0.0',
        })
      );
      expect(childLogger).toBe(logger);
    });

    it('child()로 생성된 로거가 부모 컨텍스트를 상속해야 함', () => {
      const childSpy = vi.spyOn((logger as any).logger, 'child');
      const infoSpy = vi.spyOn((logger as any).logger, 'info');

      const childLogger = logger.child({ service: 'auth-service' });

      Context.run({ requestId: 'req-child-test' }, () => {
        (childLogger as Logger).info('자식 로거 메시지');
      });

      expect(childSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-child-test',
        }),
        '자식 로거 메시지'
      );
    });

    it('child()를 여러 번 호출하여 체이닝할 수 있어야 함', () => {
      const childSpy = vi.spyOn((logger as any).logger, 'child');

      const child1 = logger.child({ layer: 'service' });
      const child2 = child1.child({ component: 'user' });
      const child3 = child2.child({ module: 'profile' });

      expect(childSpy).toHaveBeenCalledTimes(3);
      expect(child3).toBe(logger);
    });
  });

  describe('pino 설정', () => {
    it('pino가 적절한 옵션으로 호출되어야 함', () => {
      vi.clearAllMocks();
      const mockPino = vi.mocked(pino);

      logger = new Logger(mockConfig as any);

      expect(mockPino).toHaveBeenCalledTimes(1);
      const pinoOptions = mockPino.mock.calls[0][0] as Record<string, unknown>;

      expect(pinoOptions.level).toBe('info');
      expect(pinoOptions.redact).toEqual({
        paths: ['password', 'token', 'secret', '*.password', '*.token', '*.secret', 'authorization', 'cookie'],
        remove: true,
      });
      expect(pinoOptions.base).toBeDefined();
      expect(pinoOptions.transport).toBeDefined();
    });

    it('프로덕션 환경에서는 transport가 undefined여야 함', () => {
      vi.clearAllMocks();
      const mockPino = vi.mocked(pino);
      const prodConfig = {
        isProduction: true,
        get: vi.fn((key: string) => {
          if (key === 'LOG_LEVEL') return 'error';
          return undefined;
        }),
      };

      logger = new Logger(prodConfig as any);

      expect(mockPino).toHaveBeenCalledTimes(1);
      const pinoOptions = mockPino.mock.calls[0][0] as Record<string, unknown>;

      expect(pinoOptions.transport).toBeUndefined();
      expect(pinoOptions.base).toBeUndefined();
    });
  });

  describe('민감정보 마스킹', () => {
    it('pino 설정에 redact 경로가 포함되어야 함', () => {
      vi.clearAllMocks();
      const mockPino = vi.mocked(pino);

      logger = new Logger(mockConfig as any);

      const pinoOptions = mockPino.mock.calls[0][0] as Record<string, unknown>;
      const redactOptions = pinoOptions.redact as { paths: string[]; remove: boolean };

      expect(redactOptions.paths).toContain('password');
      expect(redactOptions.paths).toContain('token');
      expect(redactOptions.paths).toContain('secret');
      expect(redactOptions.paths).toContain('*.password');
      expect(redactOptions.paths).toContain('*.token');
      expect(redactOptions.paths).toContain('*.secret');
      expect(redactOptions.paths).toContain('authorization');
      expect(redactOptions.paths).toContain('cookie');
      expect(redactOptions.remove).toBe(true);
    });

    it('로그 레벨이 ConfigService에서 설정한 값이어야 함', () => {
      vi.clearAllMocks();
      const mockPino = vi.mocked(pino);
      const customConfig = {
        isProduction: false,
        get: vi.fn((key: string) => {
          if (key === 'LOG_LEVEL') return 'debug';
          return undefined;
        }),
      };

      logger = new Logger(customConfig as any);

      expect(mockPino).toHaveBeenCalledTimes(1);
      const pinoOptions = mockPino.mock.calls[0][0] as Record<string, unknown>;
      expect(pinoOptions.level).toBe('debug');
    });

    it('LOG_LEVEL이 설정되지 않으면 기본값 info를 사용해야 함', () => {
      vi.clearAllMocks();
      const mockPino = vi.mocked(pino);
      const noLogLevelConfig = {
        isProduction: false,
        get: vi.fn(() => undefined),
      };

      logger = new Logger(noLogLevelConfig as any);

      expect(mockPino).toHaveBeenCalledTimes(1);
      const pinoOptions = mockPino.mock.calls[0][0] as Record<string, unknown>;
      expect(pinoOptions.level).toBe('info');
    });
  });

  describe('통합 테스트', () => {
    it('전체 로그 라이프사이클을 통합 테스트', () => {
      const debugSpy = vi.spyOn((logger as any).logger, 'debug');
      const infoSpy = vi.spyOn((logger as any).logger, 'info');
      const warnSpy = vi.spyOn((logger as any).logger, 'warn');
      const errorSpy = vi.spyOn((logger as any).logger, 'error');

      Context.run({ requestId: 'req-integration' }, () => {
        logger.debug('디버그 정보', { step: 1 });
        logger.info('처리 시작');
        logger.warn('리소스 사용량 높음', { memory: '90%' });
        logger.error('처리 실패', new Error('Integration Test Error'));
      });

      expect(debugSpy).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-integration', step: 1 }),
        '디버그 정보'
      );

      expect(infoSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-integration' }), '처리 시작');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-integration', memory: '90%' }),
        '리소스 사용량 높음'
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-integration',
          err: expect.any(Error),
        }),
        '처리 실패'
      );
    });
  });
});
