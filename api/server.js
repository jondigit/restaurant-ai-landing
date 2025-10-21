// api/server.js
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

/**
 * CORS WHITELIST
 * Replace these with your real site origins (scheme + host only, no paths).
 * Examples:
 *   - GitHub Pages (project): "https://YOUR-USERNAME.github.io"
 *   - Netlify: "https://your-site-name.netlify.app"
 *   - Custom domain(s): "https://www.yourdomain.com", "https://yourdomain.com"
 */
const allowlist = [
  "https://YOUR-USERNAME.github.io",     // <-- change/remove as needed
  "https://your-site-name.netlify.app",  // <-- change/remove as needed
  "https://www.restaurantaihelper.com",  // optional
  "https://restaurantaihelper.com"       // optional
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow curl/Postman (no Origin header)
    if (!origin) return callback(null, true);
    if (allowlist.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// ---------- Load Data (no DB yet) ----------
/**
 * Make sure these files exist:
 *   /api/data/facts.json
 *   /api/data/menu.json
 */
const facts = JSON.parse(
  fs.readFileSync(new URL("./data/facts.json", import.meta.url), "utf-8")
);
const menu = JSON.parse(
  fs.readFileSync(new URL("./data/menu.json", import.meta.url), "utf-8")
);

// ---------- Helpers ----------
function isMenuQuestion(q) {
  return /menu|dish|vegan|vegetarian|gluten|allergen|spicy|recommend/i.test(q);
}
function listMatches(filterFn) {
  return menu.items.filter(filterFn).map((i) => i.name);
}
function allergyCaution(text) {
  return text + " Please confirm with staff for severe allergies.";
}

// ---------- Routes ----------
app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/chat/query", (req, res) => {
  const message = (req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "message required" });

  // FAQs
  if (/hour|open|close|time/i.test(message)) {
    return res.json({ reply: `We’re open ${facts.hours}.` });
  }
  if (/address|location|where/i.test(message)) {
    return res.json({
      reply: `Our address is ${facts.address}. Parking: ${facts.parking}.`
    });
  }
  if (/parking/i.test(message)) {
    return res.json({ reply: `Parking: ${facts.parking}.` });
  }
  if (/dress|attire/i.test(message)) {
    return res.json({ reply: `Dress code: ${facts.dress_code}.` });
  }

  // Menu queries
  if (isMenuQuestion(message)) {
    if (/gluten[- ]?free/i.test(message)) {
      const names = listMatches((i) => i.is_gluten_free);
      const reply = names.length
        ? `Gluten-free mains: ${names.join(", ")}.`
        : "I didn’t find gluten-free mains.";
      return res.json({ reply: allergyCaution(reply) });
    }
    if (/vegan/i.test(message)) {
      const names = listMatches((i) => i.is_vegan);
      const reply = names.length
        ? `Vegan dishes: ${names.join(", ")}.`
        : "I didn’t find vegan dishes.";
      return res.json({ reply: allergyCaution(reply) });
    }
    if (/vegetarian/i.test(message)) {
      const names = listMatches((i) => i.is_vegetarian);
      const reply = names.length
        ? `Vegetarian dishes: ${names.join(", ")}.`
        : "I didn’t find vegetarian dishes.";
      return res.json({ reply: allergyCaution(reply) });
    }
    if (/spicy|heat/i.test(message)) {
      const names = listMatches((i) => (i.spice_level || 0) > 0);
      const reply = names.length
        ? `Spicier picks: ${names.join(", ")}.`
        : "No marked spicy items right now.";
      return res.json({ reply });
    }
    const popular = menu.items.slice(0, 3).map((i) => i.name);
    return res.json({
      reply: `Guests often enjoy: ${popular.join(", ")}. Tell me if you need gluten-free/vegan/etc.`
    });
  }

  // Reservation intake starter
  if (/table|reservation|book|party/i.test(message)) {
    return res.json({
      reply:
        "I can take your reservation request. Please share your name, party size, date & time, and a phone or email.",
      followup: "reservation_intake"
    });
  }

  // Fallback
  return res.json({
    reply:
      "I can help with hours, address, parking, menu (gluten-free/vegan/spicy), and simple reservations. What would you like to know?"
  });
});

app.post("/intake/reservation", (req, res) => {
  const { name, partySize, when, phone, email, notes } = req.body || {};
  console.log("Reservation request:", { name, partySize, when, phone, email, notes });
  return res.json({ status: "received" });
});

// ---------- Start ----------
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API running on :${port}`));
