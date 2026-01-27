import type { HttpContext } from '../types';
import type { CallHandler } from './CallHandler';

export interface Interceptor {
  intercept(context: HttpContext, next: CallHandler): Promise<unknown>;
}
