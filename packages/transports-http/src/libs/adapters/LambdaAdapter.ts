import type { CrocoApp } from "../CrocoApp";
import type { LambdaHandlerOptions } from "../CrocoLambdaAdapter";
import type { LambdaHandler } from "../types";

/**
 * CrocoApp 인스턴스를 AWS Lambda 핸들러 함수로 변환합니다.
 */
export function toLambdaHandler(app: CrocoApp, options: LambdaHandlerOptions = {}): LambdaHandler {
  return app.lambdaHandler(options);
}
