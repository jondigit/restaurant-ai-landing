// api/server.js
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

/**
 * CORS WHITELIST
 * Put your actual site origins here (scheme + host only, no paths).
 * Examples:
 *  - GitHub Pages (project site): "https://YOUR-USERNAME.github.io"
 *  - Netlify: "https://your-site-name.netlify.app"
 *  - Custom domain(s): "https://www.yourdomain.com", "https://yourdomain.com"
 */
const allowlist = [
  "https://YOUR-USERNAME.github.io",       // <- replace or remove as needed
  "https://your-site-name.netlify.app",    // <- replace or remove as needed
  "https://www.restaurantaihelper.com",    // <- optional: your custom domain
  "https://restaurantaihelper.com"         // <- optional: apex domain
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow tools with no Origin header (curl/Postman) during testing
    if (!origin) return callback(null, true);
    if (allowlist.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// ---------- Load Data (no DB yet) ----------
/**
 * We keep a tiny facts file and a menu file in /api/data.
 * Make sure these files exist:
 *  - /api/data/facts.json
 *  - /api/data/menu.json
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
