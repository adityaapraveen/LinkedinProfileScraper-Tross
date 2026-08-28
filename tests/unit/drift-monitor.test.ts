import { describe, expect, it, vi } from 'vitest';
import { DriftMonitor } from '../../src/linkedin/diagnostics/drift-monitor.js';

describe('DriftMonitor', () => {
  it('returns only safe operation health fields', () => {
    const monitor = new DriftMonitor();
    monitor.record('identity', 'compatible_drift');
    const health = monitor.snapshot(['identity', 'skills']);

    expect(health.identity).toMatchObject({
      status: 'compatible_drift',
      schemaDrift: true,
    });
    expect(health.identity.lastSuccessAt).not.toBeNull();
    expect(health.skills).toEqual({
      status: 'unknown',
      lastSuccessAt: null,
      schemaDrift: false,
    });
  });

  it('preserves last success when later breaking drift occurs', () => {
    const monitor = new DriftMonitor();
    monitor.record('identity', 'healthy');
    const successfulAt = monitor.snapshot(['identity']).identity.lastSuccessAt;
    monitor.record('identity', 'breaking_drift');
    expect(monitor.snapshot(['identity']).identity.lastSuccessAt).toBe(successfulAt);
  });

  it('emits only safe compatibility observations', () => {
    const observer = vi.fn();
    const monitor = new DriftMonitor(observer);
    monitor.record('skills', 'breaking_drift');
    expect(observer).toHaveBeenCalledWith({
      section: 'skills',
      status: 'breaking_drift',
      schemaDrift: true,
    });
  });
});
