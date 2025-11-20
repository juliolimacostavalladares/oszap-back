import { Router, Request, Response } from 'express';

/**
 * Rotas de health check
 */
export function createHealthRoutes(): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      message: 'OSZap API está rodando',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

