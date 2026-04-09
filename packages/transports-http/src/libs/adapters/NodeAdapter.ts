import type { CrocoApp } from '../CrocoApp';

/**
 * CrocoApp 인스턴스를 지정한 포트에서 Node 서버로 실행합니다.
 */
export async function startServer(app: CrocoApp, port: number): Promise<void> {
  await app.listen(port);
}
