import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { SYSTEM } from "./prompt.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? "3001");
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: WEB_ORIGIN }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const ReqSchema = z.object({
  prompt: z.string().min(3),
  mood: z.string().optional().default(""),
  style: z.string().optional().default(""),
  instruments: z.string().optional().default(""),
});

/** Extract JSON from raw model output (handles markdown code blocks and prose wrapping). */
function extractSpec(content: string): object | null {
  if (typeof content !== "string" || !content.trim()) return null;
  let s = content.trim();
  const open = s.indexOf("```");
  if (open !== -1) {
    const after = s.slice(open + 3);
    const lang = after.startsWith("json\n") ? 5 : after.startsWith("json") ? 4 : after.startsWith("\n") ? 1 : 0;
    s = after.slice(lang);
    const close = s.indexOf("```");
    if (close !== -1) s = s.slice(0, close);
    s = s.trim();
  }
  try {
    const obj = JSON.parse(s);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    // No code fence or parse failed: try to find a top-level { ... } in prose
    const start = s.indexOf("{");
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    const quote = '"';
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inString) {
        if (escape) { escape = false; continue; }
        if (c === "\\") { escape = true; continue; }
        if (c === quote) { inString = false; continue; }
        continue;
      }
      if (c === quote) { inString = true; continue; }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(s.slice(start, i + 1));
            return obj && typeof obj === "object" ? obj : null;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }
}

app.post("/api/compose", async (req, res) => {
  const parsed = ReqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });

  const { prompt, mood, style, instruments } = parsed.data;

  const llm = new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: OLLAMA_MODEL,
    temperature: 0.7,
  });

  const human = `User request:
Prompt: ${prompt}
Mood: ${mood}
Style: ${style}
Instruments: ${instruments}

Generate a spec suitable for a 10-second clip.`;

  try {
    const out = await llm.invoke([new SystemMessage(SYSTEM), new HumanMessage(human)]);
    const obj = extractSpec(String(out.content ?? ""));

    if (!obj) {
      return res.status(502).json({ error: "Model did not return valid JSON", raw: out.content });
    }
    return res.json(obj);
  } catch (e: any) {
    return res.status(502).json({ error: "Failed to call Ollama via LangChain", details: String(e?.message ?? e) });
  }
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(`[api] ollama baseUrl=${OLLAMA_BASE_URL} model=${OLLAMA_MODEL}`);
});
