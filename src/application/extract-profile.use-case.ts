import type { ProfileRequest } from '../api/schemas/profile-request.schema.js';
import { DomainError, type ErrorCode } from '../domain/errors.js';
import type { ExtractionResult, SectionMetadata } from '../domain/extraction.js';
import { emptyProfile, type CanonicalProfile, type ProfileSection } from '../domain/profile.js';
import type { Cache } from '../infrastructure/cache/cache.js';
import type { ProfileContext } from '../linkedin/endpoints/endpoint-manifest.js';
import { ExtractionPlanner } from './extraction-planner.js';
import {
  SectionRunner,
  type SectionOperation,
  type SectionResult,
  type SectionTask,
} from './section-runner.js';

export interface ProfileResolver {
  resolve(slug: string, canonicalUrl: string): Promise<ProfileContext>;
}

export interface ExtractProfileDependencies {
  cache: Cache;
  resolver: ProfileResolver;
  operations: Partial<Record<ProfileSection, SectionOperation>>;
  cacheTtlSeconds: number;
  concurrency: number;
  deadlineMs: number;
}

function cacheKey(slug: string, section: ProfileSection): string {
  return `profile:${slug}:${section}`;
}

function safeErrorCode(reason: unknown): ErrorCode {
  return reason instanceof DomainError ? reason.code : 'INTERNAL_ERROR';
}

function applySection(profile: CanonicalProfile, result: SectionResult): void {
  switch (result.section) {
    case 'identity':
      profile.identity = result.data;
      break;
    case 'experience':
      profile.experience = result.data;
      break;
    case 'education':
      profile.education = result.data;
      break;
    case 'skills':
      profile.skills = result.data;
      break;
    case 'certifications':
      profile.certifications = result.data;
      break;
    case 'languages':
      profile.languages = result.data;
      break;
  }
}

export class ExtractProfileUseCase {
  private readonly planner = new ExtractionPlanner();
  private readonly runner: SectionRunner;

  constructor(private readonly dependencies: ExtractProfileDependencies) {
    this.runner = new SectionRunner(dependencies.concurrency, dependencies.deadlineMs);
  }

  async execute(request: ProfileRequest): Promise<ExtractionResult> {
    const { slug, canonicalUrl } = request.parsedUrl;
    const profile = emptyProfile(canonicalUrl);
    const metadata: Partial<Record<ProfileSection, SectionMetadata>> = {};
    const cachedSections = new Set<ProfileSection>();

    if (request.freshness === 'prefer-cache') {
      await Promise.all(
        request.sections.map(async (section) => {
          const cached = await this.dependencies.cache.get<SectionResult>(cacheKey(slug, section));
          if (!cached || cached.section !== section) return;
          applySection(profile, cached);
          cachedSections.add(section);
          metadata[section] = {
            status: 'success',
            source: 'cache.v1',
            durationMs: 0,
          };
        }),
      );
    }

    const plan = this.planner.build(request.sections, cachedSections);
    if (plan.sections.length > 0) {
      let context: ProfileContext;
      try {
        context = await this.dependencies.resolver.resolve(slug, canonicalUrl);
      } catch (error) {
        if (cachedSections.size === 0) throw error;
        for (const section of plan.sections) {
          metadata[section] = {
            status: 'failed',
            error: safeErrorCode(error),
            durationMs: 0,
          };
        }
        return this.buildResult(profile, metadata, request.sections, cachedSections);
      }

      const tasks: SectionTask[] = plan.sections.map((section) => ({
        section,
        run:
          this.dependencies.operations[section] ??
          (() =>
            Promise.reject(
              new DomainError('SECTION_UNAVAILABLE', `${section} extraction is not configured`),
            )),
      }));
      const settled = await this.runner.run(tasks, context);

      await Promise.all(
        settled.map(async ({ section, durationMs, result }) => {
          if (result.status === 'rejected') {
            metadata[section] = {
              status: 'failed',
              error: safeErrorCode(result.reason),
              durationMs,
            };
            return;
          }
          if (result.value.section !== section) {
            metadata[section] = {
              status: 'failed',
              error: 'UPSTREAM_SCHEMA_CHANGED',
              durationMs,
            };
            return;
          }
          applySection(profile, result.value);
          metadata[section] = {
            status: 'success',
            source: result.value.source,
            durationMs,
          };
          await this.dependencies.cache.set(
            cacheKey(slug, section),
            result.value,
            this.dependencies.cacheTtlSeconds,
          );
        }),
      );
    }

    return this.buildResult(profile, metadata, request.sections, cachedSections);
  }

  private buildResult(
    profile: CanonicalProfile,
    sections: Partial<Record<ProfileSection, SectionMetadata>>,
    requested: readonly ProfileSection[],
    cachedSections: ReadonlySet<ProfileSection>,
  ): ExtractionResult {
    return {
      profile,
      meta: {
        partial: requested.some((section) => sections[section]?.status === 'failed'),
        retrievedAt: new Date().toISOString(),
        cached: requested.every((section) => cachedSections.has(section)),
        sections,
      },
    };
  }
}
