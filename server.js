require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors({
  origin: "https://www.driverfleethub.com"
}));

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next(); // ⚠️ Webhook требует "raw body"
  } else {
    express.json()(req, res, next);
  }
});

// ✅ Root route for testing Render status
app.get("/", (req, res) => {
  res.send("🚛 FleetHub server is running and ready to process subscriptions.");
});

// ✅ Создание Checkout-сессии
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    console.log("🚀 Creating checkout session for user:", userId);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      client_reference_id: userId,
      success_url: `https://www.driverfleethub.com/financial-tools`,
      cancel_url: "https://www.driverfleethub.com",
      line_items: [
        {
          price: "price_1R3tlhBI2Mwax730T1svWg21",
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 3,
      },
    });

    console.log("✅ Checkout session created:", session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Webhook Stripe
app.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;

    console.log("✅ Subscription completed. userId:", userId || "not found");

    if (userId) {
      try {
        await db.collection("users").doc(userId).set(
          {
            subscriptionStatus: "active",
            subscriptionId: session.id,
            customerId: session.customer,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log("🔥 Firestore updated for user:", userId);
      } catch (err) {
        console.error("❌ Firestore update error:", err.message);
      }
    } else {
      console.warn("⚠️ No userId found. Skipping Firestore update.");
    }
  }

  res.status(200).send("Webhook received");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT} or Render`);
});
