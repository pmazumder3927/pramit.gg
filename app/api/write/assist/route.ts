import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

// "the ghost" — the writing room's quiet companion. Two kinds of help:
//   complete — a short graphite continuation offered at the end of the text
//   ask      — the summoned palette: draft / continue / rework / math / titles
//
// Everything is seeded with the owner's own published writing (style sample,
// cached) plus the current entry's vibe (type, tags, title, the draft so far),
// so the ghost writes AS the owner — never as an assistant.

export const maxDuration = 60;

const ASK_MODES = ["draft", "continue", "rework", "math", "titles"] as const;
type AskMode = (typeof ASK_MODES)[number];

let cachedClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Style sample — excerpts of the owner's published entries, refreshed hourly.
// Raw markdown on purpose: the authorial markdown habits are part of the voice.
// ---------------------------------------------------------------------------
let styleCache: { sample: string; at: number } | null = null;
const STYLE_TTL_MS = 60 * 60 * 1000;

async function getStyleSample(): Promise<string> {
  if (styleCache && Date.now() - styleCache.at < STYLE_TTL_MS) {
    return styleCache.sample;
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("posts")
      .select("title, slug, type, content, is_draft")
      .eq("is_draft", false)
      .order("created_at", { ascending: false })
      .limit(24);
    const posts = (data || []).filter(
      (p) => (p.content || "").trim().length > 600
    );
    // the voice manifesto first if it exists, then the freshest writing
    posts.sort((a, b) => {
      const am = a.slug === "why-i-bothered" ? -1 : 0;
      const bm = b.slug === "why-i-bothered" ? -1 : 0;
      return am - bm;
    });
    const picked = posts.slice(0, 4);
    const excerpts = picked.map((p) => {
      const prose = (p.content || "")
        .replace(/```[\s\S]*?```/g, "\n[code]\n")
        .replace(/<plotly-graph[^>]*><\/plotly-graph>/g, "[figure]")
        .trim()
        .slice(0, 1700);
      return `--- from "${p.title}" (a ${p.type}) ---\n${prose}`;
    });
    const sample = excerpts.join("\n\n").slice(0, 7500);
    styleCache = { sample, at: Date.now() };
    return sample;
  } catch {
    return styleCache?.sample ?? "";
  }
}

// ---------------------------------------------------------------------------
function basePersona(sample: string, vibe: string): string {
  return [
    `you are "the ghost" — the silent writing companion inside the private journal editor of pramit.gg, the personal site of pramit mazumder. you write AS pramit, in his voice. you are never an assistant and never speak in your own voice.`,
    sample
      ? `his voice, from his own published entries:\n<<<\n${sample}\n>>>`
      : "",
    vibe,
    [
      "hard rules:",
      "- match the voice: lowercase-leaning, intimate, concrete, a little wry; em-dash asides; sentences allowed to breathe. technical and precise when the entry is technical.",
      '- never assistant-speak ("certainly", "great", "in conclusion", "delve", "dive into", "it\'s worth noting"); never marketing tone; never filler.',
      "- markdown is the medium: the site renders gfm + katex. display math goes in $$ ... $$ on its own lines, inline math in $ ... $. code in fenced blocks.",
      "- output ONLY the requested text. no preamble, no quotes around it, no commentary, no sign-off.",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function vibeBlock(body: Record<string, unknown>): string {
  const title = String(body.title || "").slice(0, 200);
  const type = String(body.type || "note");
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).map(String).slice(0, 12).join(", ")
    : "";
  const blurbs: Record<string, string> = {
    musing: "reflective, opinion & whimsical writing",
    journey: "building & figuring things out — projects, deep-dives, logs",
    note: "short updates, fragments & ephemera",
  };
  return [
    `the entry being written right now:`,
    `- type: ${type} (${blurbs[type] ?? blurbs.note})`,
    title ? `- title: ${title}` : `- untitled so far`,
    tags ? `- tags: ${tags}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const clip = (s: unknown, n: number) =>
  typeof s === "string" ? (s.length > n ? s.slice(-n) : s) : "";
const clipHead = (s: unknown, n: number) =>
  typeof s === "string" ? s.slice(0, n) : "";

// gpt-5 / o-series take reasoning_effort and reject custom temperature
function knobsFor(model: string, effort: string) {
  return /^(gpt-5|o\d)/.test(model)
    ? { reasoning_effort: effort }
    : { temperature: 0.8 };
}

/** Try each model in turn — the mini tier may not exist on this account. */
async function createWithFallback(
  client: OpenAI,
  candidates: string[],
  params: Omit<
    OpenAI.Chat.Completions.ChatCompletionCreateParams,
    "model" | "stream"
  >,
  stream: boolean,
  effort: string
) {
  let lastError: unknown;
  for (const model of candidates) {
    try {
      return await client.chat.completions.create({
        ...params,
        ...knobsFor(model, effort),
        model,
        stream,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParams);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const client = getOpenAI();
  if (!client) {
    return NextResponse.json(
      { error: "the ghost has no lantern — OPENAI_API_KEY is missing" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "ask" ? "ask" : "complete";
  const sample = await getStyleSample();
  const persona = basePersona(sample, vibeBlock(body));
  const before = clip(body.before, 6000);
  const after = clipHead(body.after, 1200);
  const selection = clipHead(body.selection, 4000);
  const instruction = clipHead(body.instruction, 600);

  try {
    if (kind === "complete") {
      const completion = (await createWithFallback(
        client,
        [
          process.env.OPENAI_GHOST_MODEL?.trim() || "gpt-5.5-mini",
          "gpt-5.5",
        ],
        {
          messages: [
            { role: "system", content: persona },
            {
              role: "user",
              content: [
                `the entry so far ends exactly like this (continue from the final character):`,
                `<<<\n${before}\n>>>`,
                `continue the writing naturally. if a sentence is unfinished, finish it. offer at MOST two short sentences — a small step forward, not a paragraph. output only the continuation.`,
              ].join("\n\n"),
            },
          ],
          max_completion_tokens: 700,
        },
        false,
        process.env.OPENAI_GHOST_EFFORT?.trim() || "low"
      )) as OpenAI.Chat.Completions.ChatCompletion;
      const text = completion.choices?.[0]?.message?.content ?? "";
      return NextResponse.json({ text });
    }

    // ---- ask: the summoned palette --------------------------------------
    const mode: AskMode = ASK_MODES.includes(body.mode) ? body.mode : "draft";
    let userPrompt: string;
    const context = `the entry so far (text before the pen):\n<<<\n${before}\n>>>${
      after ? `\n\n(text after the pen):\n<<<\n${after}\n>>>` : ""
    }`;

    if (mode === "math") {
      userPrompt = [
        `turn this request into katex math for the entry. prefer display math ($$ on its own lines) for full equations, inline $...$ only for fragments. use the entry's context for symbol names if relevant.`,
        instruction ? `the request: ${instruction}` : "",
        selection ? `rough notation / description to formalize:\n<<<\n${selection}\n>>>` : "",
        context,
        `output ONLY the math, with its $ delimiters, nothing else.`,
      ]
        .filter(Boolean)
        .join("\n\n");
    } else if (mode === "titles") {
      userPrompt = [
        context,
        `offer 6 possible titles for this entry — lowercase, in my voice, no clickbait, no colons-with-subtitle formulas unless one genuinely fits. one per line, no numbering, no quotes.`,
        instruction ? `notes on what i want: ${instruction}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    } else if (mode === "rework") {
      userPrompt = [
        context,
        `rework this passage from the entry${instruction ? ` — ${instruction}` : " — keep the meaning, make it read better in my voice"}:`,
        `<<<\n${selection}\n>>>`,
        `output only the replacement passage.`,
      ].join("\n\n");
    } else if (mode === "continue") {
      userPrompt = [
        context,
        `continue the entry from exactly where it leaves off${instruction ? ` — ${instruction}` : ""}. a paragraph or two, no more. output only the continuation.`,
      ].join("\n\n");
    } else {
      userPrompt = [
        context,
        `draft a passage for this entry: ${instruction || "keep going in the spirit of what's written"}.`,
        selection
          ? `material to work from:\n<<<\n${selection}\n>>>`
          : "",
        `output only the passage, in markdown.`,
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    const stream = (await createWithFallback(
      client,
      [process.env.OPENAI_ASSIST_MODEL?.trim() || "gpt-5.5"],
      {
        messages: [
          { role: "system", content: persona },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: mode === "titles" ? 600 : 2000,
      },
      true,
      process.env.OPENAI_ASSIST_EFFORT?.trim() || "low"
    )) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (error) {
          console.error("ghost stream error:", error);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ghost error:", error);
    return NextResponse.json(
      { error: "the ghost lost its train of thought — try again" },
      { status: 502 }
    );
  }
}
