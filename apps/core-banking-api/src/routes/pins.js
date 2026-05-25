import { Router } from 'express';
import { asyncHandler } from '@pine/lib-http';
import { listActivePinMetadata } from '../services/pin.js';

export function buildPinsRouter() {
  const router = Router();

  router.get(
    '/active',
    asyncHandler(async (req, res) => {
      const pins = await listActivePinMetadata(req.user.id);
      res.json({ items: pins });
    }),
  );

  return router;
}
