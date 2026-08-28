import type { ProfileSection } from '../../domain/profile.js';
import type { DriftStatus } from './compatibility-report.js';

export interface OperationHealth {
  status: DriftStatus;
  lastSuccessAt: string | null;
  schemaDrift: boolean;
}

export class DriftMonitor {
  private readonly operations = new Map<ProfileSection, OperationHealth>();

  record(section: ProfileSection, status: DriftStatus): void {
    const previous = this.operations.get(section);
    this.operations.set(section, {
      status,
      lastSuccessAt:
        status === 'healthy' || status === 'compatible_drift'
          ? new Date().toISOString()
          : (previous?.lastSuccessAt ?? null),
      schemaDrift: status === 'compatible_drift' || status === 'breaking_drift',
    });
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
