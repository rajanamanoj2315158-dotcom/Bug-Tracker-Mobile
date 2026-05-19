import type { Express, RequestHandler } from "express";
import helmet from "helmet";
import { env } from "../env";

const forceHttps: RequestHandler = (req, res, next) => {
  if (
    env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  next();
};

export function applySecurityHeaders(app: Express) {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts:
        env.NODE_ENV === "production"
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
    }),
  );
  app.use(forceHttps);
}
