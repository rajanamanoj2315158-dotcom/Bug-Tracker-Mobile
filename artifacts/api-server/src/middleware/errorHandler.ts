import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../env";
import { logger } from "../lib/logger";

type ErrorWithStatus = Error & { status?: number; statusCode?: number };

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      message: "Route not found",
      code: 404,
      path: req.path,
    },
  });
}

export function errorHandler(
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status ?? err.statusCode ?? 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
      statusCode: safeStatus,
    },
    "Request failed",
  );

  res.status(safeStatus).json({
    error: {
      message:
        env.NODE_ENV === "production" && safeStatus === 500
          ? "An internal error occurred"
          : err.message,
      code: safeStatus,
    },
  });
}
