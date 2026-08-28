import { DomainError } from '../../domain/errors.js';

export type SessionStatus = 'unknown' | 'healthy' | 'unavailable' | 'challenge';

export interface SessionHealthSnapshot {
  status: SessionStatus;
  lastValidatedAt: string | null;
}

export class SessionHealth {
  private status: SessionStatus;
  private lastValidatedAt: string | null = null;

  constructor(sessionConfigured: boolean) {
    this.status = sessionConfigured ? 'unknown' : 'unavailable';
  }

  assertAvailable(): void {
    if (this.status === 'unavailable' || this.status === 'challenge') {
      throw new DomainError('SESSION_UNAVAILABLE', 'The upstream session is unavailable');
    }
  }

  markHealthy(): void {
    this.status = 'healthy';
    this.lastValidatedAt = new Date().toISOString();
  }

  markAuthenticationFailure(challenge: boolean): void {
    this.status = challenge ? 'challenge' : 'unavailable';
    this.lastValidatedAt = new Date().toISOString();
  }

  snapshot(): SessionHealthSnapshot {
    return { status: this.status, lastValidatedAt: this.lastValidatedAt };
  }
}
