import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { parseLinkedInProfileUrl } from '../../src/api/schemas/profile-request.schema.js';

describe('parseLinkedInProfileUrl', () => {
  it.each([
    ['https://linkedin.com/in/example', 'example'],
    ['https://www.linkedin.com/in/example-slug/', 'example-slug'],
  ])('canonicalizes %s', (input, slug) => {
    expect(parseLinkedInProfileUrl(input)).toEqual({
      slug,
      canonicalUrl: `https://www.linkedin.com/in/${slug}/`,
    });
  });

  it.each([
    'http://www.linkedin.com/in/example/',
    'https://evil.example/in/example/',
    'https://www.linkedin.com/company/example/',
    'https://www.linkedin.com/jobs/view/123/',
    'https://www.linkedin.com/in/',
    'https://www.linkedin.com/in/example/extra',
    'https://www.linkedin.com/in/example?redirect=https://evil.example',
    'https://www.linkedin.com/in/example%2f..%2fadmin',
    'https://www.linkedin.com:444/in/example/',
    'https://user:pass@www.linkedin.com/in/example/',
    'https://sales.linkedin.com/in/example/',
  ])('rejects unsafe or unsupported URL %s', (input) => {
    expect(() => parseLinkedInProfileUrl(input)).toThrow(DomainError);
  });
});
