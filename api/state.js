import { Redis } from "@upstash/redis";

// 공유 상태를 Upstash Redis 한 키에 저장한다 (읽기-쓰기 강한 일관성).
// 키 이름은 기존 배포와 동일하게 유지해서 데이터가 이어진다.
const KEY = "youth-group:roster:state";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const state = await redis.get(KEY);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).json(state && typeof state === "object" ? state : {});
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      const state = await readBody(req);
      state.updatedAt = Date.now();
      await redis.set(KEY, state);
      res.status(200).json({ ok: true, updatedAt: state.updatedAt });
      return;
    }
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error("state api error", err);
    res.status(500).json({ error: "server_error", message: String((err && err.message) || err) });
  }
}
