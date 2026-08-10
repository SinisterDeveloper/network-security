import { Request, Response } from 'express';
import { blockchainService } from '../../services/BlockchainService.js';

export const POST = async (_req: Request, res: Response): Promise<void> => {
  const retried = await blockchainService.retryPending();
  res.status(200).json({ retried, pending: blockchainService.getPendingCount() });
};

export const GET = (_req: Request, res: Response): void => {
  res.status(200).json({ pending: blockchainService.getPendingCount() });
};
