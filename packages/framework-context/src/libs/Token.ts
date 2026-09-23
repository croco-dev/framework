const TOKEN_IDENTITY = Symbol("croco.di.token.identity");

export type TokenIdentifier<T> = (new (...args: never[]) => T) | Token<T> | string | symbol;

/**
 * A type-safe dependency token whose runtime identity is the token object itself.
 * The name is diagnostic-only and never participates in equality.
 */
export class Token<T> {
  readonly [TOKEN_IDENTITY] = true;

  constructor(readonly name: string) {}

  toString(): string {
    return `Token<${this.name}>`;
  }

  /** Keeps the generic type invariant without storing a runtime value. */
  private readonly _type?: T;
}
