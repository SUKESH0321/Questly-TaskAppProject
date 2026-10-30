import type { Request, Response, NextFunction, RequestHandler } from "express";
import mongoose from "mongoose";

/**
 * Wraps an async route handler so a rejected promise becomes a normal Express
 * error instead of an unhandled rejection that crashes the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function isValidId(id: unknown): id is string {
  return typeof id === "string" && mongoose.isValidObjectId(id) && /^[a-f\d]{24}$/i.test(id);
}
