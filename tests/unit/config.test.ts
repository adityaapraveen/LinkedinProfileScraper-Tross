import { describe, expect, it } from 'vitest';
import { hasLinkedInSession, loadConfig } from '../../src/config.js';

describe('configuration', () => {
  it('loads without LinkedIn session material', () => {
    const config = loadConfig({ PUBLIC_API_KEY: 'a-secure-test-key' });
    expect(config.PORT).toBe(3000);
    expect(hasLinkedInSession(config)).toBe(false);
  });

  it('rejects partial session material', () => {
    expect(() =>
      loadConfig({ PUBLIC_API_KEY: 'a-secure-test-key', LINKEDIN_COOKIE: 'secret' }),
    ).toThrow(/must be supplied together/);
  });

  it('rejects a weak public API key', () => {
    expect(() => loadConfig({ PUBLIC_API_KEY: 'short' })).toThrow();
  });
});
