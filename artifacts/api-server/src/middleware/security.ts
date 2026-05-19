import type { Express, Request, RequestHandler } from "express";
import helmet from "helmet";
import { env } from "../env";

const SAFE_HOST_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

function isHttpsRequest(req: Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return req.secure || forwardedProto === "https";
}

function getSafeRedirectHost(req: Request) {
  if (env.API_PUBLIC_URL) return new URL(env.API_PUBLIC_URL).host;

  const host = req.get("host");
  if (!host || !SAFE_HOST_RE.test(host)) return null;
  return host;
}

const forceHttps: RequestHandler = (req, res, next) => {
  if (env.NODE_ENV === "production" && !isHttpsRequest(req)) {
    const host = getSafeRedirectHost(req);
    if (!host) {
      return res.status(400).json({ error: "Invalid Host header" });
    }

    const path = (req.originalUrl || req.url || "/").replace(/[\r\n]/g, "");
    return res.redirect(308, `https://${host}${path.startsWith("/") ? path : `/${path}`}`);
  }

  next();
};

export function applySecurityHeaders(app: Express) {
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

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
