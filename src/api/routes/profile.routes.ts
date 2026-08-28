import { Router } from 'express';
import {
  createProfileController,
  type ProfileExtractor,
} from '../controllers/profile.controller.js';

export function createProfileRouter(extractor: ProfileExtractor): Router {
  const router = Router();
  router.post('/extract', createProfileController(extractor));
  return router;
}
