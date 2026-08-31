import { describe, expect, it } from 'vitest';
import {
  parseProfileContext,
  parseProfileSection,
} from '../../src/linkedin/parsing/full-profile.parser.js';

const type = {
  profile: 'com.linkedin.voyager.dash.identity.profile.Profile',
  position: 'com.linkedin.voyager.dash.identity.profile.Position',
  positionGroup: 'com.linkedin.voyager.dash.identity.profile.PositionGroup',
  education: 'com.linkedin.voyager.dash.identity.profile.Education',
  skill: 'com.linkedin.voyager.dash.identity.profile.Skill',
  certification: 'com.linkedin.voyager.dash.identity.profile.Certification',
  language: 'com.linkedin.voyager.dash.identity.profile.Language',
  employmentType: 'com.linkedin.voyager.dash.identity.profile.EmploymentType',
  geo: 'com.linkedin.voyager.dash.common.Geo',
  collection: 'com.linkedin.restli.common.CollectionResponse',
} as const;

function collection(entityUrn: string, elements: string[]) {
  return { entityUrn, '*elements': elements, $type: type.collection };
}

const raw = {
  data: { '*elements': ['urn:li:fsd_profile:SYNTHETIC'] },
  included: [
    {
      entityUrn: 'urn:li:fsd_profile:SYNTHETIC',
      objectUrn: 'urn:li:member:SYNTHETIC',
      publicIdentifier: 'synthetic-person',
      firstName: 'Synthetic',
      lastName: 'Person',
      headline: 'Platform Engineer',
      summary: 'Builds dependable systems.',
      geoLocation: { '*geo': 'urn:li:fsd_geo:SYNTHETIC' },
      profilePicture: {
        displayImageReference: {
          vectorImage: {
            rootUrl: 'https://media.example/profile_',
            artifacts: [
              { width: 100, height: 100, fileIdentifyingUrlPathSegment: 'small.jpg' },
              { width: 800, height: 800, fileIdentifyingUrlPathSegment: 'large.jpg' },
            ],
          },
        },
      },
      backgroundPicture: {
        displayImageReference: {
          vectorImage: {
            rootUrl: 'https://media.example/background_',
            artifacts: [{ width: 1400, height: 350, fileIdentifyingUrlPathSegment: 'wide.jpg' }],
          },
        },
      },
      '*profilePositionGroups': 'urn:li:collection:position-groups',
      '*profileEducations': 'urn:li:collection:educations',
      '*profileSkills': 'urn:li:collection:skills',
      '*profileCertifications': 'urn:li:collection:certifications',
      '*profileLanguages': 'urn:li:collection:languages',
      $type: type.profile,
    },
    {
      entityUrn: 'urn:li:fsd_geo:SYNTHETIC',
      defaultLocalizedName: 'Synthetic City',
      $type: type.geo,
    },
    collection('urn:li:collection:position-groups', ['urn:li:fsd_positionGroup:SYNTHETIC']),
    {
      entityUrn: 'urn:li:fsd_positionGroup:SYNTHETIC',
      '*profilePositionInPositionGroup': 'urn:li:collection:positions',
      $type: type.positionGroup,
    },
    collection('urn:li:collection:positions', ['urn:li:fsd_position:SYNTHETIC']),
    {
      entityUrn: 'urn:li:fsd_position:SYNTHETIC',
      title: 'Senior Engineer',
      companyName: 'Synthetic Labs',
      locationName: 'Remote',
      description: 'Owned the API platform.',
      dateRange: { start: { year: 2023, month: 2 } },
      '*employmentType': 'urn:li:fsd_employmentType:FULL_TIME',
      $type: type.position,
    },
    {
      entityUrn: 'urn:li:fsd_employmentType:FULL_TIME',
      name: 'Full-time',
      $type: type.employmentType,
    },
    collection('urn:li:collection:educations', ['urn:li:fsd_education:SYNTHETIC']),
    {
      entityUrn: 'urn:li:fsd_education:SYNTHETIC',
      schoolName: 'Synthetic University',
      degreeName: 'BSc',
      fieldOfStudy: 'Computer Science',
      description: 'Systems programme',
      dateRange: { start: { year: 2018 }, end: { year: 2022 } },
      $type: type.education,
    },
    collection('urn:li:collection:skills', ['urn:li:fsd_skill:SYNTHETIC']),
    { entityUrn: 'urn:li:fsd_skill:SYNTHETIC', name: 'TypeScript', $type: type.skill },
    collection('urn:li:collection:certifications', ['urn:li:fsd_certification:SYNTHETIC']),
    {
      entityUrn: 'urn:li:fsd_certification:SYNTHETIC',
      name: 'Cloud Engineer',
      authority: 'Synthetic Cloud',
      licenseNumber: 'CERT-1',
      url: 'https://credentials.example/CERT-1',
      timePeriod: { start: { year: 2024, month: 3 }, end: { year: 2027, month: 3 } },
      $type: type.certification,
    },
    collection('urn:li:collection:languages', ['urn:li:fsd_language:SYNTHETIC']),
    {
      entityUrn: 'urn:li:fsd_language:SYNTHETIC',
      name: 'English',
      proficiency: 'NATIVE_OR_BILINGUAL',
      $type: type.language,
    },
  ],
};

describe('full profile parser', () => {
  const context = parseProfileContext(
    raw,
    'synthetic-person',
    'https://www.linkedin.com/in/synthetic-person/',
  );

  it('resolves stable profile context from the normalized graph', () => {
    expect(context.profileUrn).toBe('urn:li:fsd_profile:SYNTHETIC');
    expect(context.memberUrn).toBe('urn:li:member:SYNTHETIC');
  });

  it('parses identity, location, about, and the largest available images', () => {
    expect(parseProfileSection('identity', context).data).toEqual({
      name: 'Synthetic Person',
      firstName: 'Synthetic',
      lastName: 'Person',
      headline: 'Platform Engineer',
      location: 'Synthetic City',
      about: 'Builds dependable systems.',
      images: {
        profile: 'https://media.example/profile_large.jpg',
        background: 'https://media.example/background_wide.jpg',
      },
    });
  });

  it('parses experience and education through collection references', () => {
    expect(parseProfileSection('experience', context).data).toEqual([
      {
        title: 'Senior Engineer',
        company: 'Synthetic Labs',
        employmentType: 'Full-time',
        location: 'Remote',
        description: 'Owned the API platform.',
        startDate: { year: 2023, month: 2 },
        endDate: null,
        isCurrent: true,
      },
    ]);
    expect(parseProfileSection('education', context).data).toEqual([
      {
        school: 'Synthetic University',
        degree: 'BSc',
        fieldOfStudy: 'Computer Science',
        startYear: 2018,
        endYear: 2022,
        description: 'Systems programme',
      },
    ]);
  });

  it('parses skills, certifications, and languages', () => {
    expect(parseProfileSection('skills', context).data).toEqual([{ name: 'TypeScript' }]);
    expect(parseProfileSection('certifications', context).data).toEqual([
      {
        name: 'Cloud Engineer',
        authority: 'Synthetic Cloud',
        issuedAt: '2024-03',
        expiresAt: '2027-03',
        credentialId: 'CERT-1',
        credentialUrl: 'https://credentials.example/CERT-1',
      },
    ]);
    expect(parseProfileSection('languages', context).data).toEqual([
      { name: 'English', proficiency: 'NATIVE_OR_BILINGUAL' },
    ]);
  });
});
