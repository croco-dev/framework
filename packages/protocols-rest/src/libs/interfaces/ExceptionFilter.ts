import type { HttpContext } from '../types';

export interface ExceptionFilter<T = unknown> {
  catch(exception: T, context: HttpContext): unknown;
}
