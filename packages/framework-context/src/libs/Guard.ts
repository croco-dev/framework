/**
 * 라우트/메서드 실행 전 접근 제어를 검사하는 Guard 인터페이스입니다.
 *
 * @template TContext - Guard 실행 컨텍스트 타입입니다.
 *
 * @example
 * ```typescript
 * import type { Guard } from '@croco/framework-context';
 *
 * class AdminGuard implements Guard<RouteExecutionContext> {
 *   canActivate(context: RouteExecutionContext): boolean {
 *     return context.getRequest().user?.role === 'admin';
 *   }
 * }
 * ```
 */
export interface Guard<TContext = unknown> {
  canActivate(context: TContext): boolean | Promise<boolean>;
}
