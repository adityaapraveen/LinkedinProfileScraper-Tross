export const profileSections = [
  'identity',
  'experience',
  'education',
  'skills',
  'certifications',
  'languages',
] as const;

export type ProfileSection = (typeof profileSections)[number];

export interface CanonicalDate {
  year: number | null;
  month: number | null;
}

export interface CanonicalProfile {
  profileUrl: string;
  identity: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
    location: string | null;
    about: string | null;
    images: { profile: string | null; background: string | null };
  } | null;
  experience: Array<{
    title: string | null;
    company: string | null;
    employmentType: string | null;
    location: string | null;
    description: string | null;
    startDate: CanonicalDate | null;
    endDate: CanonicalDate | null;
    isCurrent: boolean;
  }>;
  education: Array<{
    school: string | null;
    degree: string | null;
    fieldOfStudy: string | null;
    startYear: number | null;
    endYear: number | null;
    description: string | null;
  }>;
  skills: Array<{ name: string }>;
  certifications: Array<{
    name: string | null;
    authority: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    credentialId: string | null;
    credentialUrl: string | null;
  }>;
  languages: Array<{ name: string; proficiency: string | null }>;
}

export function emptyProfile(profileUrl: string): CanonicalProfile {
  return {
    profileUrl,
    identity: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}
