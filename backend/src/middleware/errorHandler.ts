import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found." });
}

/**
 * Last-resort error handler. Turns thrown/rejected errors into JSON responses
 * so a bad request can never crash the server.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  // Body too large (images are sent as base64)
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "The upload is too large." });
    return;
  }
  // Malformed JSON body
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    res.status(400).json({ error: "Malformed JSON request body." });
    return;
  }
  // Mongoose: bad ObjectId or failed validation
  if (err?.name === "CastError") {
    res.status(400).json({ error: "Invalid identifier in request." });
    return;
  }
  if (err?.name === "ValidationError") {
    const first = Object.values(err.errors ?? {})[0] as { message?: string } | undefined;
    res.status(400).json({ error: first?.message || "Validation failed." });
    return;
  }
  if (err?.code === 11000) {
    res.status(409).json({ error: "That record already exists." });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: env.isProduction ? "Something went wrong." : String(err?.message ?? err),
  });
}
