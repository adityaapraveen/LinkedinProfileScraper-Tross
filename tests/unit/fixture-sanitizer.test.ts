import { describe, expect, it } from 'vitest';
import { sanitizeFixture } from '../../src/linkedin/diagnostics/fixture-sanitizer.js';

describe('fixture sanitizer', () => {
  it('fails closed when personal scalar paths are not covered', () => {
    expect(() =>
      sanitizeFixture({ firstName: 'Private Name', year: 2026 }, { replacements: {} }),
    ).toThrow(/\$\.firstName, \$\.year/);
  });

  it('replaces values by path while preserving structure and types', () => {
    const sanitized = sanitizeFixture(
      {
        included: [
          {
            firstName: 'Private Name',
            entityUrn: 'urn:li:fsd_profile:private-id',
            $type: 'com.linkedin.example.Profile',
            active: true,
          },
        ],
      },
      {
        replacements: {
          '$.included[0].firstName': 'Synthetic',
          '$.included[0].entityUrn': 'urn:li:fsd_profile:SYNTHETIC_1',
        },
      },
    );

    expect(sanitized).toEqual({
      included: [
        {
          firstName: 'Synthetic',
          entityUrn: 'urn:li:fsd_profile:SYNTHETIC_1',
          $type: 'com.linkedin.example.Profile',
          active: true,
        },
      ],
    });
    expect(JSON.stringify(sanitized)).not.toContain('Private Name');
    expect(JSON.stringify(sanitized)).not.toContain('private-id');
  });

  it('always redacts secret-bearing keys', () => {
    expect(
      sanitizeFixture(
        { cookie: 'live-cookie', nested: { csrfToken: 'live-csrf' } },
        { replacements: {} },
      ),
    ).toEqual({ cookie: '[REDACTED]', nested: { csrfToken: '[REDACTED]' } });
  });

  it('rejects replacements that change JSON types', () => {
    expect(() =>
      sanitizeFixture(
        { numericIdentifier: 123 },
        { replacements: { '$.numericIdentifier': 'synthetic' } },
      ),
    ).toThrow(/preserve the original JSON type/);
  });
});
