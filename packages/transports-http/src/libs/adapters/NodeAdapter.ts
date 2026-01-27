import type { CrocoApp } from '../CrocoApp';

export async function startServer(app: CrocoApp, port: number): Promise<void> {
  await app.listen(port);
}
