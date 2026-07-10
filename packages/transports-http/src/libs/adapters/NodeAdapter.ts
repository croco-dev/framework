import type { CrocoApp } from "../CrocoApp";
import type { NodeServerHandle } from "../types";

/**
 * CrocoApp 인스턴스를 지정한 포트에서 Node 서버로 실행합니다.
 */
export async function startServer(app: CrocoApp, port: number): Promise<NodeServerHandle> {
  return app.listen(port);
}
