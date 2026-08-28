import { describe, expect, it } from 'vitest';
import {
  SectionRunner,
  type SectionOperation,
  type SectionTask,
} from '../../src/application/section-runner.js';

const context = {
  slug: 'sample',
  canonicalUrl: 'https://www.linkedin.com/in/sample/',
  profileUrn: null,
  memberUrn: null,
};

describe('SectionRunner', () => {
  it('enforces bounded concurrency and isolates failures', async () => {
    let active = 0;
    let maximumActive = 0;
    const operation =
      (section: 'skills' | 'languages', shouldFail = false): SectionOperation =>
      async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setImmediate(resolve));
        active -= 1;
        if (shouldFail) throw new Error('synthetic failure');
        return section === 'skills'
          ? { section: 'skills', data: [], source: 'skills.test' }
          : { section: 'languages', data: [], source: 'languages.test' };
      };
    const tasks: SectionTask[] = [
      { section: 'skills', run: operation('skills') },
      { section: 'languages', run: operation('languages', true) },
      { section: 'skills', run: operation('skills') },
    ];

    const results = await new SectionRunner(2, 1000).run(tasks, context);
    expect(maximumActive).toBe(2);
    expect(results.map((result) => result.result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
  });
});
