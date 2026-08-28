import type { ProfileSection } from '../domain/profile.js';

export interface ExtractionPlan {
  requiresResolution: boolean;
  sections: ProfileSection[];
}

export class ExtractionPlanner {
  build(requested: readonly ProfileSection[], cached: ReadonlySet<ProfileSection>): ExtractionPlan {
    const sections = requested.filter((section) => !cached.has(section));
    return { requiresResolution: sections.length > 0, sections };
  }
}
