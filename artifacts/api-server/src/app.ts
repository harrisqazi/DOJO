import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { createClient } from "@supabase/supabase-js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const app: Express = express();

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

app.use(cors());

// Raw body for Stripe webhook — must come BEFORE express.json()
app.use("/api/stripe-webhook", express.raw({ type: "application/json" }));

// JSON body for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth middleware: validate Supabase JWT and set x-user-id header
app.use("/api", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Skip auth for public endpoints
  const PUBLIC = ["/api/healthz", "/api/stripe-webhook", "/api/dojos/by-slug/"];
  if (PUBLIC.some(p => req.path.startsWith(p.replace("/api", "")))) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    next();
    return;
  }

  try {
    const supabase = createClient(url, key);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      req.headers["x-user-id"] = user.id;

      // Upsert user profile if not exists
      const [profile] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
      if (!profile) {
        await db.insert(usersTable).values({
          id: user.id,
          email: user.email ?? null,
          name: user.user_metadata?.name ?? null,
          role: "student",
          subscription_status: "free",
        }).onConflictDoNothing();
      }
    }
  } catch {
    // Swallow auth errors — routes will 401 if x-user-id not set
  }

  next();
});

app.use("/api", router);

export default app;
