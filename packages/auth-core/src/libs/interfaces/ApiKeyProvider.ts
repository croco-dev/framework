import type { ApiKeyPrincipal } from "./Principal";

export interface ApiKeyProvider<TRequest = unknown> {
  authenticate(request: TRequest): Promise<ApiKeyPrincipal | null>;
}
