import type { TokenIdentifier } from "@croco/framework-context";

const TEST_RESOURCE_PROVIDER = Symbol("croco.testing-resource-provider");

export type TestResourceProvider<TConnection> = {
  readonly [TEST_RESOURCE_PROVIDER]: true;
  readonly provide: (connection: TConnection) => unknown;
  readonly token: TokenIdentifier<unknown>;
};

export function testResourceProvider<TConnection, TValue>(
  token: TokenIdentifier<TValue>,
  provide: (connection: TConnection) => TValue,
): TestResourceProvider<TConnection> {
  return {
    [TEST_RESOURCE_PROVIDER]: true,
    provide,
    token: token as TokenIdentifier<unknown>,
  };
}
