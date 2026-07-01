import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { db, usersTable, dojosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

// Stripe webhook — must use raw body
router.post("/stripe-webhook", async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    req.log.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  // Respond immediately, process async
  res.json({ received: true });

  setImmediate(async () => {
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer as string;
          const metadata = session.metadata ?? {};

          if (metadata.type === "dojo") {
            await db.update(dojosTable)
              .set({ subscription_status: "active", stripe_customer_id: customerId })
              .where(eq(dojosTable.id, metadata.dojo_id));
          } else {
            await db.update(usersTable)
              .set({ subscription_status: "active", stripe_customer_id: customerId })
              .where(eq(usersTable.stripe_customer_id, customerId));

            // Also try to match by email
            if (session.customer_email) {
              await db.update(usersTable)
                .set({ subscription_status: "active", stripe_customer_id: customerId })
                .where(eq(usersTable.email, session.customer_email));
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const status = sub.status === "active" ? "active" : sub.status === "canceled" ? "canceled" : sub.status;

          await db.update(usersTable)
            .set({ subscription_status: status })
            .where(eq(usersTable.stripe_customer_id, customerId));

          await db.update(dojosTable)
            .set({ subscription_status: status })
            .where(eq(dojosTable.stripe_customer_id, customerId));
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;

          await db.update(usersTable)
            .set({ subscription_status: "canceled" })
            .where(eq(usersTable.stripe_customer_id, customerId));

          await db.update(dojosTable)
            .set({ subscription_status: "canceled" })
            .where(eq(dojosTable.stripe_customer_id, customerId));
          break;
        }
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Error processing Stripe webhook");
    }
  });
});

// Create Stripe Checkout session
router.post("/stripe/checkout", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  const { price_type, success_url, cancel_url } = req.body;

  const stripe = getStripe();

  const PRICES: Record<string, string> = {
    student_monthly: process.env.STRIPE_PRICE_STUDENT_MONTHLY ?? "price_student_monthly",
    student_yearly: process.env.STRIPE_PRICE_STUDENT_YEARLY ?? "price_student_yearly",
    dojo_starter: process.env.STRIPE_PRICE_DOJO_STARTER ?? "price_dojo_starter",
    dojo_pro: process.env.STRIPE_PRICE_DOJO_PRO ?? "price_dojo_pro",
  };

  const priceId = PRICES[price_type];
  if (!priceId) { res.status(400).json({ error: "Invalid price_type" }); return; }

  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:80";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url ?? `${baseUrl}/dashboard?checkout=success`,
      cancel_url: cancel_url ?? `${baseUrl}/dashboard`,
      metadata: { userId, type: price_type.startsWith("dojo") ? "dojo" : "student" },
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Error creating Stripe checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Create Stripe Customer Portal session
router.post("/stripe/portal", async (req, res): Promise<void> => {
  const { dojo_id, return_url } = req.body;
  if (!dojo_id) { res.status(400).json({ error: "dojo_id required" }); return; }

  const [dojo] = await db.select().from(dojosTable).where(eq(dojosTable.id, dojo_id));
  if (!dojo?.stripe_customer_id) {
    res.status(404).json({ error: "No Stripe customer found for this dojo" });
    return;
  }

  const stripe = getStripe();
  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:80";

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: dojo.stripe_customer_id,
      return_url: return_url ?? `${baseUrl}/dojo-admin`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    req.log.error({ err }, "Error creating Stripe portal session");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

export default router;
