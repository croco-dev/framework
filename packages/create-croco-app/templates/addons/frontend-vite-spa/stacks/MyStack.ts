import { Function as SstFunction, StaticSite } from 'sst/aws';

/**
 * Croco API(Lambda) + Vite SPA(S3/CloudFront) 배포 스택
 *
 * 주의: 이 recipe는 선택사항입니다. SST가 필수가 아닌
 * Node 단일 컨테이너 배포(T4 static serving)로 시작하는 것을 권장합니다.
 *
 * esbuild가 @croco/reflect-metadata + TypeDI decorators와
 * 충돌할 수 있습니다. 충돌 시 esbuild plugins 옵션에 decorators
 * 지원 플러그인을 추가하세요.
 */

export async function myStack() {
  const api = new SstFunction('Api', {
    handler: 'apps/api/src/handler.ts',
    url: true,
  });

  new StaticSite('Web', {
    build: {
      command: 'pnpm run build',
      output: 'apps/web/dist',
    },
    environment: {
      VITE_API_URL: api.url,
    },
  });
}
