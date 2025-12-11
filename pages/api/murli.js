// pages/api/murli.js
import dayjs from "dayjs";

let murliStore = {}; // in-memory store { "YYYY-MM-DD": { date, metadata, content } }

// GET ?date=YYYY-MM-DD  -> returns murli or 404
// POST (admin only) -> create/update murli (must include ADMIN_TOKEN header)

export default async function handler(req, res) {
  if (req.method === "GET") {
    const date = req.query.date || dayjs().format("YYYY-MM-DD");
    const entry = murliStore[date];
    if (!entry) return res.status(404).json({ error: "No Murli for date", date });
    return res.json(entry);
  }

  if (req.method === "POST") {
    const token = req.headers["x-admin-token"] || req.body?.adminToken;
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { date, metadata, content } = req.body;
    if (!date || !content) return res.status(400).json({ error: "date and content required" });
    murliStore[date] = { date, metadata: metadata || {}, content };
    return res.json({ ok: true, date });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
