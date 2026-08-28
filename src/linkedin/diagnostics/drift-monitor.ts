import type { ProfileSection } from '../../domain/profile.js';
import type { DriftStatus } from './compatibility-report.js';

export interface OperationHealth {
  status: DriftStatus;
  lastSuccessAt: string | null;
  schemaDrift: boolean;
}

export interface DriftObservation {
  section: ProfileSection;
  status: DriftStatus;
  schemaDrift: boolean;
}

export type DriftObserver = (observation: DriftObservation) => void;

export class DriftMonitor {
  private readonly operations = new Map<ProfileSection, OperationHealth>();

  constructor(private readonly observer?: DriftObserver) {}

  record(section: ProfileSection, status: DriftStatus): void {
    const previous = this.operations.get(section);
    const health = {
      status,
      lastSuccessAt:
        status === 'healthy' || status === 'compatible_drift'
          ? new Date().toISOString()
          : (previous?.lastSuccessAt ?? null),
      schemaDrift: status === 'compatible_drift' || status === 'breaking_drift',
    } satisfies OperationHealth;
    this.operations.set(section, health);
    this.observer?.({ section, status, schemaDrift: health.schemaDrift });
  }

  snapshot(sections: readonly ProfileSection[]): Record<ProfileSection, OperationHealth> {
    return Object.fromEntries(
      sections.map((section) => [
        section,
        this.operations.get(section) ?? {
          status: 'unknown',
          lastSuccessAt: null,
          schemaDrift: false,
        },
      ]),
    ) as Record<ProfileSection, OperationHealth>;
  }
}
