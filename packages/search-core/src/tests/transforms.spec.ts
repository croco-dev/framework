import { describe, expect, it } from 'vitest';
import { derive } from '../libs/transforms/derive';
import { InMemorySearchTransformRegistry } from '../libs/transforms/SearchTransformRegistry';
import { textTransforms } from '../libs/transforms/textTransforms';
import type { SearchTransformAdapter } from '../libs/transforms/types';

describe('derive()', () => {
  it('returns SearchDerivedFieldConfig with transformId', () => {
    const config = derive(textTransforms.initials);

    expect(config.transformId).toBe('text.initials');
  });

  it('accepts options with correct type', () => {
    const config = derive(textTransforms.initials, {
      options: { locale: 'ko' },
      filterable: true,
    });

    expect(config.options).toEqual({ locale: 'ko' });
    expect(config.filterable).toBe(true);
  });

  it('supports custom field name via as option', () => {
    const config = derive(textTransforms.decomposed, { as: 'name_jamo' });

    expect(config.as).toBe('name_jamo');
  });
});

describe('SearchTransformRegistry', () => {
  it('registers and retrieves adapters', () => {
    const registry = new InMemorySearchTransformRegistry();
    const mockAdapter = {
      id: 'test.mock',
      defaultSuffix: '_mock',
      transform: (input: string) => input.toUpperCase(),
    } as SearchTransformAdapter<unknown>;

    registry.register(mockAdapter);

    expect(registry.get({ id: 'test.mock', defaultSuffix: '_mock' })).toBe(mockAdapter);
  });

  it('applies transform to input', () => {
    const registry = new InMemorySearchTransformRegistry();
    registry.register({
      id: 'text.initials',
      defaultSuffix: '_initials',
      transform: (input: string) => input.charAt(0),
    } as SearchTransformAdapter<unknown>);

    const result = registry.apply(textTransforms.initials, 'Hello');

    expect(result).toBe('H');
  });

  it('throws when transform not found', () => {
    const registry = new InMemorySearchTransformRegistry();

    expect(() => registry.apply(textTransforms.initials, 'Hello')).toThrow('Transform not found: text.initials');
  });
});

describe('textTransforms', () => {
  it('defines built-in text transform references', () => {
    expect(textTransforms.initials).toEqual({
      id: 'text.initials',
      defaultSuffix: '_initials',
    });
    expect(textTransforms.decomposed).toEqual({
      id: 'text.decomposed',
      defaultSuffix: '_decomposed',
    });
    expect(textTransforms.romanized).toEqual({
      id: 'text.romanized',
      defaultSuffix: '_romanized',
    });
  });
});
