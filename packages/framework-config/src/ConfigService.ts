import { Component } from '@croco/framework-context';
import { env } from './core';

@Component({ scope: 'singleton' })
export class ConfigService {
  /**
   * Type-safe environment variable getter
   */
  get<K extends keyof typeof env>(key: K): (typeof env)[K] {
    return env[key];
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  get isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }
}
