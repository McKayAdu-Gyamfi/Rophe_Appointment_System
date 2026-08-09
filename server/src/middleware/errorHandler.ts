import { Request, Response, NextFunction } from "express";

// 404 handler — for unmatched routes
export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

// Central error handler — catches thrown errors from routes
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
