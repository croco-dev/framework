import { Function as SstFunction, StaticSite } from 'sst/aws';
import type { Stack, StackProps } from 'sst/constructs';

/**
 * SST는 선택사항이다.
 *
 * 이 스택은 Vite SPA + Croco API를 SST로 분리 배포하는 예제다.
 * Node 단일 컨테이너 배포가 가능하다면 이 파일을 사용하지 않아도 된다.
 *
 * SST를 사용하지 않으면:
 * - `packages/api/src/index.ts`에서 직접 Express/Hono 서버를 실행
 * - 빌드된 SPA 파일을 같은 서버에서 서빙
 */

export interface MyStackProps extends StackProps {
  /** API 핸들러 경로 */
  apiHandler?: string;
  /** SPA 빌드 명령어 */
  buildCommand?: string;
  /** SPA 빌드 출력 디렉토리 */
  buildOutput?: string;
  /** SPA 소스 디렉토리 */
  sitePath?: string;
}

export function MyStack(app: Stack, props: MyStackProps = {}) {
  const {
    apiHandler = 'packages/api/src/handler.ts',
    buildCommand = 'pnpm run build',
    buildOutput = 'dist',
    sitePath = 'packages/web',
  } = props;

  /**
   * Croco API Lambda
   *
   * @croco/reflect-metadata와 TypeDI 데코레이터 사용 시 esbuild가 번들에서
   * 메타데이터를 제거할 수 있다. 다음 옵션으로 방지:
   * - handler: 'packages/api/src/handler.ts'
   * - nodejs: { esbuild: { alias: { 'reflect-metadata': 'reflect-metadata' } } }
   *
   * 참고: `createApp(config).lambdaHandler()`는 API Gateway v2와 호환된다.
   */
  const api = new SstFunction(app, 'Api', {
    handler: apiHandler,
    url: true,
  });

  /**
   * Vite SPA (S3 + CloudFront)
   *
   * build.command: SPA 빌드 명령어
   * build.output: 빌드 출력 디렉토리 (기본: dist)
   * environment: Vite에서 사용할 환경변수 주입
   */
  new StaticSite(app, 'Web', {
    path: sitePath,
    build: {
      command: buildCommand,
      output: buildOutput,
    },
    environment: {
      VITE_API_URL: api.url,
    },
  });
}
