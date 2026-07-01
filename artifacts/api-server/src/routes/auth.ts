import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    let [profile] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    if (!profile) {
      const inviteCode = user.user_metadata?.invite_code as string | undefined;
      let dojoId: string | null = null;

      if (inviteCode) {
        const { dojosTable } = await import("@workspace/db");
        const [dojo] = await db.select().from(dojosTable).where(eq(dojosTable.invite_code, inviteCode));
        if (dojo) dojoId = dojo.id;
      }

      [profile] = await db.insert(usersTable).values({
        id: user.id,
        email: user.email ?? null,
        name: user.user_metadata?.name ?? null,
        role: "student",
        dojo_id: dojoId,
        subscription_status: "free",
      }).returning();
    }

    res.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      dojo_id: profile.dojo_id,
      stripe_customer_id: profile.stripe_customer_id,
      subscription_status: profile.subscription_status,
      camera_side: profile.camera_side,
      created_at: profile.created_at,
    });
  } catch (err) {
    req.log.error({ err }, "Error in /auth/me");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
