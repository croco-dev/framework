import { AuthGuard } from "@croco/auth-core";
import { Component } from "@croco/framework-context";
import type { RouteExecutionContext } from "@croco/auth-core";
import type { TestAuthProvider } from "./TestAuthProvider";

@Component()
export class ApiKeyGuard {
  private readonly delegate: AuthGuard;

  constructor(provider: TestAuthProvider) {
    this.delegate = new AuthGuard(provider);
  }

  canActivate(context: RouteExecutionContext): Promise<boolean> {
    return this.delegate.canActivate(context);
  }
}
