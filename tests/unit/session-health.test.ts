import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { SessionHealth } from '../../src/linkedin/client/session-health.js';

describe('SessionHealth', () => {
  it('opens the circuit after authentication failure', () => {
    const health = new SessionHealth(true);
    health.markAuthenticationFailure(false);
    expect(() => health.assertAvailable()).toThrow(DomainError);
    expect(health.snapshot().status).toBe('unavailable');
  });

  it('starts unavailable without configured session material', () => {
    const health = new SessionHealth(false);
    expect(() => health.assertAvailable()).toThrowError(/unavailable/);
  });

  it('records successful validation', () => {
    const health = new SessionHealth(true);
    health.markHealthy();
    expect(health.snapshot()).toMatchObject({ status: 'healthy' });
    expect(health.snapshot().lastValidatedAt).not.toBeNull();
  });
});
