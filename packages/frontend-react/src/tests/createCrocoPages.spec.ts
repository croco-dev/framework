import { describe, expect, it } from 'vitest';

import { createCrocoPageConfig } from '../libs/createCrocoPages';

describe('createCrocoPageConfig', () => {
  it('기본값 확인 - ssr: true, passToClient 포함', () => {
    const config = createCrocoPageConfig();

    expect(config.ssr).toBe(true);
    expect(config.passToClient).toEqual(['data', 'title', 'description']);
  });

  it('ssr: false 옵션 전달 시 ssr: false 확인', () => {
    const config = createCrocoPageConfig({ ssr: false });

    expect(config.ssr).toBe(false);
    expect(config.passToClient).toEqual(['data', 'title', 'description']);
  });
});
