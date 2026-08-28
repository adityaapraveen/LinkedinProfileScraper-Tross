import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  SessionHealth,
  type SessionHealthObserver,
} from '../../src/linkedin/client/session-health.js';

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

  it('emits safe status transitions without session material', () => {
    const observer = vi.fn<SessionHealthObserver>();
    const health = new SessionHealth(true, observer);
    health.markHealthy();
    health.markHealthy();
    health.markAuthenticationFailure(true);

    expect(observer).toHaveBeenCalledTimes(2);
    expect(observer.mock.calls.map(([transition]) => transition)).toMatchObject([
      { from: 'unknown', to: 'healthy' },
      { from: 'healthy', to: 'challenge' },
    ]);
    expect(JSON.stringify(observer.mock.calls)).not.toContain('cookie');
  });
});
