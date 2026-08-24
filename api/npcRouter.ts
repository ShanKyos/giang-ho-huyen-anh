/**
 * AI NPC — Giai đoạn 1: NPC biết nhận thức thế giới (thiết kế: docs AI NPC GĐ1)
 * 3 NPC thí điểm: truonglang · duoclao · quachtinh.
 * Provider-agnostic qua env: LLM_API_KEY / LLM_BASE_URL / LLM_MODEL (chuẩn OpenAI-compatible).
 * Nguyên tắc fallback tuyệt đối: mọi lỗi → thoại có sẵn, game không bao giờ vỡ vì AI.
 */
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

/* ---------- cấu hình provider (env, không commit key) ---------- */
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const LLM_MODEL = process.env.LLM_MODEL || "openai/gpt-oss-120b";
const LLM_TIMEOUT_MS = 6000;
// effort suy luận: Groq gpt-oss cần "low" để không đốt token vào thinking; provider khác set LLM_REASONING_EFFORT=none
const LLM_EFFORT = process.env.LLM_REASONING_EFFORT ?? "low";
const DAILY_LIMIT = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;

/* ---------- hồ sơ NPC: nhân cách + luật bất khả phạm ---------- */
type NpcProfile = {
  name: string;
  persona: string;
  fallback: string[]; // thoại dự phòng khi LLM không khả dụng / hết lượt
};
const NPC_PROFILES: Record<string, NpcProfile> = {
  truonglang: {
    name: "Trưởng Làng Thanh Ngưu",
    persona:
      "Ngươi là Trưởng Làng Thanh Ngưu trên Đào Hoa Đảo — lão nhân hiền từ đã nuôi dưỡng người chơi từ nhỏ (xưng hô: ta - con). " +
      "Tính cách: hiền hậu, khôn ngoan, hay lo lắng cho con, thích nhắc chuyện ngày xưa và dặn dò cẩn thận. " +
      "Kiến thức giới hạn: chuyện làng chài, Đào Hoa Đảo, lễ nghi nhập môn, đường đi Tương Dương. " +
      "KHÔNG biết bí mật võ công cao thâm hay cốt truyện chương sau — nếu bị hỏi, lắc đầu cười và khuyên con đi hỏi Quách Đại Hiệp.",
    fallback: [
      "Con à, trời biển dạo này lắm gió… ra khơi cẩn thận vào nhé.",
      "Ta già rồi, đầu óc hay quên — hôm khác quay lại ta kể con nghe chuyện xưa.",
      "Ừ hừm… câu này để ta suy nghĩ đã, con ghé Dược Phường mua ít thuốc dự phòng đi.",
    ],
  },
  duoclao: {
    name: "Dược Lão · Dược Phường",
    persona:
      "Ngươi là Dược Lão chủ Dược Phường trong thành Tương Dương (xưng hô: lão phu - tiểu tử/khách quân). " +
      "Tính cách: cục cằn bề ngoài nhưng tâm thiện, mê dược thảo như mạng, hay càu nhàu chuyện tiền bạc, coi thuốc men là nghệ thuật. " +
      "Kiến thức giới hạn: dược liệu, hồi máu, độc dược, Thảo Dược ở Đào Hoa Đảo, giá cả thuốc men. " +
      "KHÔNG biết chuyện quân cơ hay bí kíp võ công — bị hỏi thì quát 'lão phu chỉ bán thuốc!'.",
    fallback: [
      "Hừ, thuốc hay cứu người, thuốc độc cũng cứu người — tùy ai dùng. Mua thì mua, không mua đừng chận cửa!",
      "Tiểu tử lảm nhảm gì đấy? Lão phu đang bận xem lửa hầm thuốc.",
      "Đợi đấy, lão phu đếm lại mấy củ linh chi đã…",
    ],
  },
  quachtinh: {
    name: "Quách Đại Hiệp",
    persona:
      "Ngươi là Quách Đại Hiệp trấn thủ thành Tương Dương, đại hiệp vì quốc vì dân (xưng hô: ta - vị tiểu hiệp/ngươi). " +
      "Tính cách: chính trực, đôn hậu, nghiêm túc, đặt nặng khí tiết hiệp nghĩa; kính trọng người có tài, răn dạy kẻ tà tâm. " +
      "Phản ứng đặc biệt: người chơi Tội Ác cao (>=3) thì nghiêm khắc khuyên răn; cấp thấp thì khuyên rèn luyện; có môn phái thì khen ngợi khích lệ. " +
      "Kiến thức giới hạn: tình hình Tương Dương, quân Mông Cổ, 7 môn phái, nghĩa cử giang hồ. " +
      "KHÔNG tiết lộ trận pháp phòng thủ hay kế hoạch quân sự chi tiết.",
    fallback: [
      "Vì quốc vì dân, hiệp giả đại giả. Tương Dương còn, ta còn.",
      "Tiểu hiệp có lòng hỏi là tốt — nhưng trước hết hãy rèn võ nghệ cho vững.",
      "Quân tình khẩn cấp, ta phải đi tuần thành. Hôm khác nói chuyện tiếp.",
    ],
  },
};

const GLOBAL_RULES =
  "\n\nLUẬT BẤT KHẢ PHẠM:\n" +
  "- Trả lời 1-3 câu NGẮN, tiếng Việt, văn phong giang hồ kiếm hiệp thời Nam Tống.\n" +
  "- TUYỆT ĐỐI không dùng từ hiện đại: internet, xe, điện thoại, game, AI, mô hình ngôn ngữ, vũ trụ, khoa học viễn tưởng...\n" +
  "- Không bao giờ thừa nhận mình là AI hay chương trình máy tính.\n" +
  "- Không hứa tặng vật phẩm, bạc, nhiệm vụ — chỉ trò chuyện.\n" +
  "- Phản ứng phù hợp trạng thái người chơi trong ngữ cảnh (thương tích, tội ác, cảnh giới, môn phái).\n" +
  "- Không lặp lại nguyên văn câu hỏi của người chơi.";

/* ---------- input ---------- */
const ctxSchema = z.object({
  level: z.number().int().min(1).max(200),
  sect: z.string().max(50),
  realm: z.string().max(50),
  hpPct: z.number().min(0).max(100),
  sin: z.number().min(0).max(999),
  traits: z.array(z.string().max(40)).max(5),
  pers: z.string().max(30),
  mapName: z.string().max(60),
  questName: z.string().max(80),
  season: z.string().max(20),
  weather: z.string().max(30),
});
const chatInput = z.object({
  npcId: z.enum(["truonglang", "duoclao", "quachtinh"]),
  message: z.string().trim().min(1).max(200),
  ctx: ctxSchema,
});

/* ---------- rate limit (in-memory theo IP — mock GĐ1) ---------- */
const dayKey = () => new Date().toISOString().slice(0, 10);
const usage = new Map<string, { day: string; count: number }>();
function checkRate(ip: string): number {
  const u = usage.get(ip);
  if (!u || u.day !== dayKey()) {
    usage.set(ip, { day: dayKey(), count: 0 });
    return DAILY_LIMIT;
  }
  return Math.max(0, DAILY_LIMIT - u.count);
}
function consumeRate(ip: string) {
  const u = usage.get(ip);
  if (u) u.count++;
}

/* ---------- cache câu trả lời (10 phút, cùng NPC + cùng câu hỏi) ---------- */
const cache = new Map<string, { reply: string; at: number }>();
function cacheGet(k: string): string | null {
  const c = cache.get(k);
  if (c && Date.now() - c.at < CACHE_TTL_MS) return c.reply;
  if (c) cache.delete(k);
  return null;
}

/* ---------- gọi LLM ---------- */
async function callLlm(system: string, user: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 200,
        temperature: 0.8,
        ...(LLM_EFFORT && LLM_EFFORT !== "none" ? { reasoning_effort: LLM_EFFORT } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(npc: NpcProfile, input: z.infer<typeof chatInput>): { system: string; user: string } {
  const c = input.ctx;
  const ctxLines = [
    `Ngữ cảnh người chơi hiện tại: cấp ${c.level}, môn phái ${c.sect}, cảnh giới ${c.realm}.`,
    `Sinh lực còn ${c.hpPct}%. Tội Ác: ${c.sin}. Khí chất: ${c.pers}. Quẻ tính cách: ${c.traits.join(", ") || "chưa rõ"}.`,
    `Đang ở: ${c.mapName}. Nhiệm vụ đang làm: ${c.questName || "không có"}. Thời tiết: ${c.season}, ${c.weather}.`,
  ].join("\n");
  return {
    system: npc.persona + "\n\n" + ctxLines + GLOBAL_RULES,
    user: input.message,
  };
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

/* ---------- router ---------- */
export const npcRouter = createRouter({
  status: publicQuery.query(() => ({
    enabled: Boolean(LLM_API_KEY),
    dailyLimit: DAILY_LIMIT,
  })),

  chat: publicQuery.input(chatInput).mutation(async ({ input, ctx }) => {
    const npc = NPC_PROFILES[input.npcId];
    const ip = clientIp(ctx.req);
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    // 1. rate limit
    const remaining = checkRate(ip);
    if (remaining <= 0) {
      return { reply: pick(npc.fallback), remaining: 0, ai: false, reason: "rate_limited" };
    }

    // 2. thiếu key → fallback (game vẫn chơi bình thường)
    if (!LLM_API_KEY) {
      return { reply: pick(npc.fallback), remaining, ai: false, reason: "no_key" };
    }

    // 3. cache
    const cacheKey = `${input.npcId}|${input.message.toLowerCase().trim()}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return { reply: cached, remaining, ai: true, reason: "cache" };
    }

    // 4. gọi LLM
    consumeRate(ip);
    const prompt = buildPrompt(npc, input);
    const reply = await callLlm(prompt.system, prompt.user);
    if (!reply) {
      return { reply: pick(npc.fallback), remaining: remaining - 1, ai: false, reason: "llm_error" };
    }

    // 5. vệ sinh output: cắt quá dài
    const clean = reply.length > 400 ? reply.slice(0, 397) + "…" : reply;
    cache.set(cacheKey, { reply: clean, at: Date.now() });
    return { reply: clean, remaining: remaining - 1, ai: true, reason: "ok" };
  }),
});
