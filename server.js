const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const stripe = require("stripe")("sk_live_YOUR_SECRET_KEY"); // replace with real key

// Directly embed service account object (no .env BS)
const serviceAccount = {
  "type": "service_account",
  "project_id": "fleet-hub-65314",
  "private_key_id": "your_private_key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCc8WkS+bUwMtYe\n0t3TzQGa+BKWt9XD/49jWa0lPrVbB0A+TXSFYAl+PWlgc+iUce8Qo0VvfgUbBrrH\nZoR64SmE2Nwdnw9yJUjWPqIOWfPFrB1KJOnMNGGcBiljwaDgaEuG9G+giqmPmhKM\nnnOHFIwGlPd/x8RCT1y09IHuaXQy3etWO+Ept5deopXcEVA83qXWrfCmnT+I6DNg\ni1aUUWnaaorTtfOh0t3aOu/D4loLsAcajzcAUOlL0nsKOIkaZ6p2Q8xfX8N8HYnr\n5NawsC13QJybzdjlndpzTkbLKveNU24CLkSoabkxUGm3Of7q+l8Dwar786XEhTbM\nG7TLWbiDAgMBAAECggEAQVRKcWApmJEoyXbsaPyG5QvLrRqELMzGUsxjA0R5uJUp\nnGWgkd56xSZqJYDKOXS915anUjRKisf/2v4lOoNcxZSB+ACcrN6xVaGH0uKF02yE\nWrdH7T2GvixgcUqKHa+8dMZuaw0dbQ3tF8TjgUC/0wOSjQnKe/HOPPMk3OnfuUY5\nQthwav9X9MMKCbGUteDncmIiJtW7e9xWquGtLObTMjl76xpOBnEepcpzGRcF18Pq\nfi6qfb9fKJ21w376r4y5XIJfBHVmcS9a1P+ciQAE+JQlSeDUbjkMLRW2h+YNuY+f\nK4ehxF9/oUjYt2rg6sIERB/ObPG3668yWLgb27oLiQKBgQDUve4q/ZA6pyp/QjET\nB+d9edLUdrdfEjHF3gdbsJg7qp6S74BlRmubdAss3S+chstbuUNGciQj1LdC6Pqa\nXQxptqxpMdv/ZoIi13TJP6FLIQuhlcqrbtTSOirDqV7HTnfgAoaZiDt4Ab7TkxeU\njrwNSsYjw4ci9CuGYZ6qpeMmiwKBgQC82uxfqXvhKU5s3HpK1AEY0fQLBPZsKFuh\n+A5jgZmCLq7czvUB0LwYMgxWemfihHpYrZKrfXCYVBAjTNZxt2rP+pFMBQrV21zN\nSELmr0hq63oeTWjO2qZh9zxpXM7cmt1LEhKpdcKcX0IkP/Y2tti0Vm+UXqXxOhG9\n5GVzxits6QKBgQDSxK0OmJJpGa8Hz2tRQHZ/IM/YwRkhLqRzNWqy032vN3XNe00I\niUEZDVn5A9YkzILzB9P4GiNmAFvkBXAquN8QaPPdcJFWMpfhrvY8YDcLeNzOJNpb\nB/3/nbM6kDWfXkVzgO0bdRX96jTF5qfo/ZSf0qIFUrUy0xfAFj0dMiaeywKBgQCt\n62b3ihudde7Vbg3pT2hbNS7r3vwZCumoNcr6dGWsb9V1X9pee55dIeoe0cdN4fbS\nJ7cE2xaQEgpyl9Z9Dw78zaJ1QceCvuut2ThTPWURoh3qPhuhM9c6LPejiGaw3qWg\n9tnc2agJXeiJfaX/KVBUc616E9f6WSHxoJ6VihB/0QKBgQDDKphHDl/Tzvq2fnbo\nm+QfJMw/ZJ0zYme+P43Ifs6q84lfIyZ4ZlcdYZ5rALR/uru5kpqsJxg/pDHoTVdw\nebqCmc/skIPb3Fky5XOzeN8YkS7mywIvInk/APqusjz8abnfsvG7wp6i3shO6zjz\nx9kbTHKD45X+wb/fu9aZOyDIqg==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@fleet-hub-65314.iam.gserviceaccount.com",
  "client_id": "your_client_id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40fleet-hub-65314.iam.gserviceaccount.com"
};

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
      "whsec_YOUR_SECRET" // replace with actual secret
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