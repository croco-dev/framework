import type { CrocoApp } from '../CrocoApp';
import type { LambdaHandler } from '../types';

export function toLambdaHandler(app: CrocoApp): LambdaHandler {
  return app.lambdaHandler();
}
