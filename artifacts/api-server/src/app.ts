import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { env } from "./env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter, authLimiter } from "./middleware/rateLimit";
import { applySecurityHeaders } from "./middleware/security";

const app: Express = express();
const localDevOrigins = [
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:18115",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:18115",
];

function toOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const allowedOrigins = new Set(
  [...(env.NODE_ENV === "production" ? [] : localDevOrigins), env.FRONTEND_URL]
    .map(toOrigin)
    .filter((origin): origin is string => Boolean(origin)),
);

function isAllowedOrigin(origin: string) {
  const normalized = toOrigin(origin);
  return normalized !== null && allowedOrigins.has(normalized);
}

applySecurityHeaders(app);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      logger.warn({ origin }, "CORS origin rejected");
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter, router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
