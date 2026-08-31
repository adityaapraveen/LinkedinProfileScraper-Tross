import { DomainError } from '../../domain/errors.js';
import type { CanonicalDate, CanonicalProfile, ProfileSection } from '../../domain/profile.js';
import type { SectionResult } from '../../application/section-runner.js';
import type { ProfileContext } from '../endpoints/endpoint-manifest.js';
import { EntityGraph } from './entity-graph.js';

type Entity = Readonly<Record<string, unknown>>;

const PROFILE = 'com.linkedin.voyager.dash.identity.profile.Profile';
const POSITION = 'com.linkedin.voyager.dash.identity.profile.Position';
const POSITION_GROUP = 'com.linkedin.voyager.dash.identity.profile.PositionGroup';
const EDUCATION = 'com.linkedin.voyager.dash.identity.profile.Education';
const SKILL = 'com.linkedin.voyager.dash.identity.profile.Skill';
const CERTIFICATION = 'com.linkedin.voyager.dash.identity.profile.Certification';
const LANGUAGE = 'com.linkedin.voyager.dash.identity.profile.Language';
const GEO = 'com.linkedin.voyager.dash.common.Geo';
const SOURCE = 'full-profile.v1';

function isEntity(value: unknown): value is Entity {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function child(entity: Entity, key: string): Entity | null {
  const value = entity[key];
  return isEntity(value) ? value : null;
}

function profileEntity(raw: unknown): Entity {
  const profile = new EntityGraph(raw).getByType(PROFILE)[0];
  if (!profile) {
    throw new DomainError('UPSTREAM_SCHEMA_CHANGED', 'The full profile entity is missing');
  }
  return profile;
}

function canonicalDate(value: unknown): CanonicalDate | null {
  if (!isEntity(value)) return null;
  const year = number(value.year);
  const month = number(value.month);
  if (year === null && month === null) return null;
  return { year, month };
}

function dateLabel(value: unknown): string | null {
  const date = canonicalDate(value);
  if (!date?.year) return null;
  return date.month ? `${date.year}-${String(date.month).padStart(2, '0')}` : String(date.year);
}

function referencedEntities(graph: EntityGraph, owner: Entity, field: string): Entity[] {
  const collectionUrn = text(owner[field]);
  if (!collectionUrn) return [];
  const collection = graph.getByUrn(collectionUrn);
  if (!collection) return [];
  const values = Array.isArray(collection['*elements'])
    ? collection['*elements']
    : Array.isArray(collection.elements)
      ? collection.elements
      : [];
  return values.flatMap((value) => {
    if (isEntity(value)) return [value];
    const urn = text(value);
    const entity = urn ? graph.getByUrn(urn) : null;
    return entity ? [entity] : [];
  });
}

function entitiesFor(graph: EntityGraph, profile: Entity, field: string, type: string): Entity[] {
  const referenced = referencedEntities(graph, profile, field).filter(
    (entity) => entity.$type === type,
  );
  return referenced.length > 0 ? referenced : [...graph.getByType(type)];
}

function positions(graph: EntityGraph, profile: Entity): Entity[] {
  const groups = entitiesFor(graph, profile, '*profilePositionGroups', POSITION_GROUP);
  const grouped = groups.flatMap((group) =>
    referencedEntities(graph, group, '*profilePositionInPositionGroup').filter(
      (entity) => entity.$type === POSITION,
    ),
  );
  return grouped.length > 0 ? grouped : [...graph.getByType(POSITION)];
}

function imageUrl(value: unknown): string | null {
  if (!isEntity(value)) return null;
  const display = child(value, 'displayImageReference');
  const original = child(value, 'originalImageReference');
  const reference = display ?? original;
  const vector = reference ? child(reference, 'vectorImage') : null;
  const rootUrl = vector ? text(vector.rootUrl) : null;
  const artifacts =
    vector && Array.isArray(vector.artifacts) ? vector.artifacts.filter(isEntity) : [];
  if (!rootUrl || artifacts.length === 0) return null;
  const largest = [...artifacts].sort(
    (left, right) =>
      (number(right.width) ?? 0) * (number(right.height) ?? 0) -
      (number(left.width) ?? 0) * (number(left.height) ?? 0),
  )[0];
  const segment = largest ? text(largest.fileIdentifyingUrlPathSegment) : null;
  if (!segment) return null;
  try {
    return new URL(segment.startsWith('http') ? segment : `${rootUrl}${segment}`).toString();
  } catch {
    return null;
  }
}

function identity(graph: EntityGraph, profile: Entity): CanonicalProfile['identity'] {
  const firstName = text(profile.firstName);
  const lastName = text(profile.lastName);
  const geoReference = child(profile, 'geoLocation');
  const geoUrn = geoReference ? (text(geoReference['*geo']) ?? text(geoReference.geoUrn)) : null;
  const geo = geoUrn ? graph.getByUrn(geoUrn) : graph.getByType(GEO)[0];
  const name = [firstName, lastName].filter(Boolean).join(' ') || null;
  return {
    name,
    firstName,
    lastName,
    headline: text(profile.headline),
    location:
      (geo ? text(geo.defaultLocalizedName) : null) ??
      text(profile.locationName) ??
      text(profile.address),
    about: text(profile.summary),
    images: {
      profile: imageUrl(profile.profilePicture),
      background: imageUrl(profile.backgroundPicture),
    },
  };
}

function experience(graph: EntityGraph, profile: Entity): CanonicalProfile['experience'] {
  return positions(graph, profile).map((position) => {
    const range = child(position, 'dateRange');
    const employmentUrn = text(position['*employmentType']) ?? text(position.employmentTypeUrn);
    const employment = employmentUrn ? graph.getByUrn(employmentUrn) : null;
    const startDate = range ? canonicalDate(range.start) : null;
    const endDate = range ? canonicalDate(range.end) : null;
    return {
      title: text(position.title),
      company: text(position.companyName),
      employmentType: employment ? text(employment.name) : null,
      location: text(position.locationName) ?? text(position.geoLocationName),
      description: text(position.description),
      startDate,
      endDate,
      isCurrent: startDate !== null && endDate === null,
    };
  });
}

function education(graph: EntityGraph, profile: Entity): CanonicalProfile['education'] {
  return entitiesFor(graph, profile, '*profileEducations', EDUCATION).map((item) => {
    const range = child(item, 'dateRange');
    return {
      school: text(item.schoolName),
      degree: text(item.degreeName),
      fieldOfStudy: text(item.fieldOfStudy),
      startYear: range ? number(child(range, 'start')?.year) : null,
      endYear: range ? number(child(range, 'end')?.year) : null,
      description: text(item.description),
    };
  });
}

function skills(graph: EntityGraph, profile: Entity): CanonicalProfile['skills'] {
  return entitiesFor(graph, profile, '*profileSkills', SKILL).flatMap((item) => {
    const name = text(item.name);
    return name ? [{ name }] : [];
  });
}

function certifications(graph: EntityGraph, profile: Entity): CanonicalProfile['certifications'] {
  return entitiesFor(graph, profile, '*profileCertifications', CERTIFICATION).map((item) => {
    const range = child(item, 'timePeriod') ?? child(item, 'dateRange');
    return {
      name: text(item.name),
      authority: text(item.authority) ?? text(item.issuingOrganization),
      issuedAt: range ? dateLabel(range.start) : null,
      expiresAt: range ? dateLabel(range.end) : null,
      credentialId: text(item.licenseNumber) ?? text(item.credentialId),
      credentialUrl: text(item.url) ?? text(item.credentialUrl),
    };
  });
}

function languages(graph: EntityGraph, profile: Entity): CanonicalProfile['languages'] {
  return entitiesFor(graph, profile, '*profileLanguages', LANGUAGE).flatMap((item) => {
    const name = text(item.name);
    return name ? [{ name, proficiency: text(item.proficiency) }] : [];
  });
}

export function parseProfileContext(
  raw: unknown,
  slug: string,
  canonicalUrl: string,
): ProfileContext {
  const profile = profileEntity(raw);
  return {
    slug,
    canonicalUrl,
    profileUrn: text(profile.entityUrn),
    memberUrn: text(profile.objectUrn),
    rawProfile: raw,
  };
}

export function parseProfileSection(
  section: ProfileSection,
  context: ProfileContext,
): SectionResult {
  if (!context.rawProfile) {
    throw new DomainError('UPSTREAM_SCHEMA_CHANGED', 'The full profile response is unavailable');
  }
  const graph = new EntityGraph(context.rawProfile);
  const profile = profileEntity(context.rawProfile);
  switch (section) {
    case 'identity':
      return { section, data: identity(graph, profile), source: SOURCE };
    case 'experience':
      return { section, data: experience(graph, profile), source: SOURCE };
    case 'education':
      return { section, data: education(graph, profile), source: SOURCE };
    case 'skills':
      return { section, data: skills(graph, profile), source: SOURCE };
    case 'certifications':
      return { section, data: certifications(graph, profile), source: SOURCE };
    case 'languages':
      return { section, data: languages(graph, profile), source: SOURCE };
  }
}
