import type { AuthUser } from './AuthUser';
import type { ApiKeyPrincipal, Principal } from './Principal';

export type AuthRequest = Request & {
  principal?: Principal;
  apiKey?: ApiKeyPrincipal;
  user?: AuthUser;
};
