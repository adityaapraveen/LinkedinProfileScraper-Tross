import { DomainError } from '../../domain/errors.js';

export type SessionStatus = 'unknown' | 'healthy' | 'unavailable' | 'challenge';

export interface SessionHealthSnapshot {
  status: SessionStatus;
  lastValidatedAt: string | null;
}

export interface SessionHealthTransition {
  from: SessionStatus;
  to: SessionStatus;
  at: string;
}

export type SessionHealthObserver = (transition: SessionHealthTransition) => void;

export class SessionHealth {
  private status: SessionStatus;
  private lastValidatedAt: string | null = null;

  constructor(
    sessionConfigured: boolean,
    private readonly observer?: SessionHealthObserver,
  ) {
    this.status = sessionConfigured ? 'unknown' : 'unavailable';
  }

  assertAvailable(): void {
    if (this.status === 'unavailable' || this.status === 'challenge') {
      throw new DomainError('SESSION_UNAVAILABLE', 'The upstream session is unavailable');
    }
  }

  markHealthy(): void {
    this.transitionTo('healthy');
  }

  markAuthenticationFailure(challenge: boolean): void {
    this.transitionTo(challenge ? 'challenge' : 'unavailable');
  }

  snapshot(): SessionHealthSnapshot {
    return { status: this.status, lastValidatedAt: this.lastValidatedAt };
  }

  private transitionTo(next: SessionStatus): void {
    const previous = this.status;
    const at = new Date().toISOString();
    this.status = next;
    this.lastValidatedAt = at;
    if (previous !== next) this.observer?.({ from: previous, to: next, at });
  }
}
