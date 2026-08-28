import { describe, expect, it } from 'vitest';
import { EntityGraph } from '../../src/linkedin/parsing/entity-graph.js';

describe('EntityGraph', () => {
  it('indexes included entities by stable identifiers and type', () => {
    const first = { entityUrn: 'urn:test:entity:alpha', $type: 'test.Alpha', label: 'Alpha' };
    const second = { trackingUrn: 'urn:test:tracking:beta', $type: 'test.Beta' };
    const graph = new EntityGraph({ included: [first, second] });

    expect(graph.getByUrn('urn:test:entity:alpha')).toBe(first);
    expect(graph.getByUrn('urn:test:tracking:beta')).toBe(second);
    expect(graph.getByType('test.Alpha')).toEqual([first]);
  });

  it('handles malformed and missing identifiers safely', () => {
    const graph = new EntityGraph({ included: [null, 42, {}, { entityUrn: 7, $type: null }] });
    expect(graph.getByUrn('missing')).toBeNull();
    expect(graph.getByType('missing')).toEqual([]);
  });

  it('does not mutate the raw envelope', () => {
    const raw = {
      included: [{ entityUrn: 'urn:test:entity:immutable', $type: 'test.Immutable' }],
    };
    const before = structuredClone(raw);
    new EntityGraph(raw);
    expect(raw).toEqual(before);
  });

  it('keeps the first entity for duplicate identifiers instead of relying on position lookup', () => {
    const first = { entityUrn: 'urn:test:duplicate', value: 'first' };
    const second = { entityUrn: 'urn:test:duplicate', value: 'second' };
    const graph = new EntityGraph({ included: [first, second] });
    expect(graph.getByUrn('urn:test:duplicate')).toBe(first);
  });
});
