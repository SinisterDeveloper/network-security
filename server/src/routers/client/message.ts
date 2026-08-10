import { Request, Response } from 'express';
import { messageService } from '../../services/MessageService.js';

export const POST = async (req: Request, res: Response): Promise<void> => {
  const { id, kyberCiphertextBase64, ivBase64 } = req.body as {
    id?: string | number;
    kyberCiphertextBase64?: unknown;
    ivBase64?: unknown;
  };
  const rawData = (req.body as Record<string, unknown>).data ??
    (req.body as Record<string, unknown>).payloadCiphertextBase64;
  const data = rawData as unknown;

  if (typeof data !== 'string') { res.status(400).json({ error: '"data" must be a base64 string (alias: payloadCiphertextBase64)' }); return; }
  if (typeof kyberCiphertextBase64 !== 'string') { res.status(400).json({ error: '"kyberCiphertextBase64" (string) is required' }); return; }
  if (typeof ivBase64 !== 'string') { res.status(400).json({ error: '"ivBase64" (string) is required' }); return; }

  try {
    const { message } = await messageService.create({
      id: id as string | number,
      data,
      kyberCiphertextBase64,
      ivBase64,
    });
    res.status(201).json(message);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : 'Internal error';
    res.status(status).json({ error: msg });
  }
};

export const GET = (req: Request, res: Response): void => {
  const { id } = req.query as { id?: string | string[] };
  const rawId = Array.isArray(id) ? id[0] : id;
  try {
    const messages = messageService.list(rawId as string);
    res.status(200).json(messages);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : 'Internal error';
    res.status(status).json({ error: msg });
  }
};
