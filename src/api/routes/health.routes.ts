import { Router } from 'express';
import {
  createUpstreamHealthController,
  type UpstreamHealthReader,
} from '../controllers/upstream-health.controller.js';

export function createUpstreamHealthRouter(reader: UpstreamHealthReader): Router {
  const router = Router();
  router.get('/', createUpstreamHealthController(reader));
  return router;
}
