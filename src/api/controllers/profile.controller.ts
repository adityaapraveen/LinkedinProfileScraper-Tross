import type { NextFunction, Request, Response } from 'express';
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
      response.json(result);
    } catch (error) {
      next(error);
    }
  };
}
