/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Component scope types
 */
export type Scope = 'singleton' | 'request' | 'transient';

/**
 * Token for dependency injection
 * Can be a class constructor or a unique identifier
 */
export type Token<T = any> = Constructor<T> | string | symbol;

/**
 * Generic constructor type
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Component options for @Component decorator
 */
export interface ComponentOptions {
  scope?: Scope;
}

/**
 * Internal component metadata
 */
export interface ComponentMetadata {
  scope: Scope;
  target: Constructor;
}

/**
 * Request context data
 */
export interface RequestContext {
  requestId: string;
}
