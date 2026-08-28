import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '../../domain/errors.js';
import type { ExtractionResult } from '../../domain/extraction.js';
import type { ProfileRequest } from '../schemas/profile-request.schema.js';
import { profileRequestSchema } from '../schemas/profile-request.schema.js';

export interface ProfileExtractor {
  execute(request: ProfileRequest): Promise<ExtractionResult>;
}

export function createProfileController(extractor: ProfileExtractor) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = profileRequestSchema.parse(request.body);
      const result = await extractor.execute(input);
      for (const [operation, section] of Object.entries(result.meta.sections)) {
        if (!section) continue;
        request.log.info(
          {
            operation,
            durationMs: section.durationMs,
            cacheHit: section.source === 'cache.v1',
            sectionStatus: section.status,
            ...(section.error ? { errorCode: section.error } : {}),
          },
          'Profile section extraction completed',
        );
      }
      response.json(result);
    } catch (error) {
      if (error instanceof DomainError) {
        request.log.warn(
          { operation: 'extract-profile', errorCode: error.code },
          'Profile extraction failed',
        );
      }
      next(error);
    }
  };
}
