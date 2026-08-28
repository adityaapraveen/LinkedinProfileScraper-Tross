import type { ErrorCode } from './errors.js';
import type { CanonicalProfile, ProfileSection } from './profile.js';

export type Freshness = 'prefer-cache' | 'live';

export interface SectionMetadata {
  status: 'success' | 'failed';
  source?: string;
  error?: ErrorCode;
  durationMs: number;
}

export interface ExtractionResult {
  profile: CanonicalProfile;
  meta: {
    partial: boolean;
    retrievedAt: string;
    cached: boolean;
    sections: Partial<Record<ProfileSection, SectionMetadata>>;
  };
}
