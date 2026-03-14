import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * The allowed HTTP method names that route files can export.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A route handler module exports named functions matching HTTP method names.
 * Each export is a standard Express RequestHandler.
 */
export type RouteModule = Partial<Record<HttpMethod, RequestHandler>>;

/**
 * Wraps a route handler to catch async errors and forward them to Express's
 * next() error handler, so individual route files don't need try/catch.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export interface Device {
	id: string;
	name: string;
	puf: string;
	mac: string;
	publicKey: string;
	messages: Message[];
	registeredAt: number;
}

export interface Message {
	data: any;
	timestamp: number;
	hash: any;
	sender: string;
}
