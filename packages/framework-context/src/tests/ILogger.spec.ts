import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Logger } from '../../../framework-logger/src/Logger';
import type { ILogger } from '../index';
import { LOGGER_TOKEN } from '../index';
import { Container } from '../libs/Container';

describe('ILogger', () => {
  beforeEach(() => {
    Container.reset();
  });

  afterEach(() => {
    Container.reset();
  });

  it('should expose LOGGER_TOKEN with the ILogger name', () => {
    expect(LOGGER_TOKEN.name).toBe('ILogger');
  });

  it('should be compatible with Logger instances', () => {
    const acceptsLogger = <T extends ILogger>(_logger: T) => true;
    const isAssignable = acceptsLogger<Logger>;

    expect(isAssignable).toBeTypeOf('function');
  });
});
