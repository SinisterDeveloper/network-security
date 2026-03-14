import { Request, Response } from 'express';

// In-memory client store for demonstration purposes
const clientStore: { id: number; name: string; email: string }[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
];
let nextId = 3;

/**
 * GET /client/users
 * Returns all registered clients.
 */
export const GET = (_req: Request, res: Response): void => {
  res.status(200).json({ users: clientStore });
};

/**
 * POST /client/users
 * Registers a new client.
 * Body: { name: string; email: string }
 */
export const POST = (req: Request, res: Response): void => {
  const { name, email } = req.body as { name?: string; email?: string };

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: '"name" (string) is required' });
    return;
  }
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: '"email" (string) is required' });
    return;
  }

  const client = { id: nextId++, name, email };
  clientStore.push(client);
  res.status(201).json({ user: client });
};
