import type { AuthUser } from './AuthUser';

export interface AuthProvider<TRequest = unknown> {
  authenticate(request: TRequest): Promise<AuthUser | null>;
}
