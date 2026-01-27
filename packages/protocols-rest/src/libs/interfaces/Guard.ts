import type { HttpContext } from '../types';

export interface Guard {
  canActivate(context: HttpContext): boolean | Promise<boolean>;
}
