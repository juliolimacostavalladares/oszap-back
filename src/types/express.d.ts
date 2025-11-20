/**
 * Extensões de tipos para Express
 */
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      // Adicione extensões customizadas aqui se necessário
    }
  }
}

