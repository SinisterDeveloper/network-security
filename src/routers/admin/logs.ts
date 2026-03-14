import { Request, Response } from 'express';

// In-memory log store for demonstration purposes
const logStore: { id: number; message: string; timestamp: string }[] = [];
let nextId = 1;

/**
 * GET /admin/logs
 * Returns all stored log entries.
 */
export const GET = (_req: Request, res: Response): void => {
  res.status(200).json({ logs: logStore });
};

/**
 * POST /admin/logs
 * Creates a new log entry.
 * Body: { message: string }
 */
export const POST = (req: Request, res: Response): void => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: '"message" (string) is required' });
    return;
  }

  const entry = {
    id: nextId++,
    message,
    timestamp: new Date().toISOString(),
  };

  logStore.push(entry);
  res.status(201).json({ log: entry });
};
