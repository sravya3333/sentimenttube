import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

type Sentiment = "Positive" | "Negative" | "Neutral";

interface CommentInput {
  id: string;
  text: string;
  author: string;
  publishedAt?: string;
}

interface AnalyzedComment extends CommentInput {
  sentiment: Sentiment;
  reasoning: string;
  confidence: number;
  keywords: string[];
}

const POSITIVE_WORDS = [
  "helpful", "great", "amazing", "love", "loved", "loving", "thank", "thanks",
  "awesome", "top notch", "keep it up", "excellent", "best", "good", "nice",
  "perfect", "fantastic", "brilliant", "wonderful", "enjoyed", "useful",
];

const NEGATIVE_WORDS = [
  "waste", "disagree", "confused", "bad", "terrible", "awful", "hate",
  "boring", "useless", "worst", "not my cup", "don't like", "dont like",
  "don't agree", "dont agree", "don't really agree", "misleading", "disappointing",
];

const NEGATORS = ["not", "no", "never", "isn't", "isnt", "wasn't", "wasnt", "don't", "dont", "doesn't", "doesnt", "hardly"];

/** Strip HTML tags and decode common entities (YouTube's textDisplay returns HTML). */
function cleanText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  return [...new Set(words)].slice(0, 3);
}

/** Whole-word/phrase matching; a negator within 2 words before a positive/negative word flips it. */
function scoreText(lower: string) {
  let pos = 0;
  let neg = 0;
  const tokens = lower
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const joined = " " + tokens.join(" ") + " ";

  const check = (list: string[], isPositive: boolean) => {
    for (const phrase of list) {
      const re = new RegExp(`(?<=\\s)${escapeRegex(phrase)}(?=\\s)`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(joined)) !== null) {
        const before = joined.slice(0, m.index).trim().split(" ").slice(-2);
        const phraseHasNegation = /\b(not|don't|dont)\b/.test(phrase);
        const negated = !phraseHasNegation && before.some((w) => NEGATORS.includes(w));
        const countsAsPositive = negated ? !isPositive : isPositive;
        if (countsAsPositive) pos++;
        else neg++;
      }
    }
  };
  check(POSITIVE_WORDS, true);
  check(NEGATIVE_WORDS, false);
  return { pos, neg };
}

function analyzeWithRules(comments: CommentInput[]): AnalyzedComment[] {
  return comments.map((comment) => {
    const text = cleanText(comment.text);
    const { pos: positiveHits, neg: negativeHits } = scoreText(text.toLowerCase());

    let sentiment: Sentiment = "Neutral";
    let reasoning = "No strong positive or negative signals detected.";
    let confidence = 0.55;

    if (positiveHits > negativeHits) {
      sentiment = "Positive";
      reasoning = "Comment contains appreciative or supportive language.";
      confidence = Math.min(0.95, 0.6 + positiveHits * 0.1);
    } else if (negativeHits > positiveHits) {
      sentiment = "Negative";
      reasoning = "Comment contains critical or dissatisfied language.";
      confidence = Math.min(0.95, 0.6 + negativeHits * 0.1);
    }

    return {
      ...comment,
      text,
      publishedAt: comment.publishedAt || new Date().toISOString(),
      sentiment,
      reasoning,
      confidence,
      keywords: extractKeywords(text),
    };
  });
}
async function withRetry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const retryable = err?.status === 503 || err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
      if (!retryable || i === tries - 1) throw err;
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw new Error("Retry failed");
}
async function analyzeWithGemini(comments: CommentInput[]): Promise<AnalyzedComment[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return analyzeWithRules(comments);
  }

  comments = comments.map((c) => ({ ...c, text: cleanText(c.text) }));
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Analyze the sentiment of the following YouTube comments.
For each comment:
1. Categorize as "Positive", "Negative", or "Neutral".
2. Provide a brief reasoning.
3. Provide a confidence score (0-1).
4. Extract 2-3 key technical or emotional keywords.

Comments:
${comments.map((c, i) => `${i + 1}. "${c.text}"`).join("\n")}

Return the results as a JSON array of objects with fields: index (1-based), sentiment, reasoning, confidence, keywords (array).`;

  const response = await withRetry(() => ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER },
            sentiment: { type: Type.STRING, enum: ["Positive", "Negative", "Neutral"] },
            reasoning: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["index", "sentiment", "reasoning", "confidence", "keywords"],
        },
      },
    },
  }));

  const results = JSON.parse(response.text || "[]");

  return comments.map((comment, idx) => {
    const result = results.find((r: { index: number }) => r.index === idx + 1);
    return {
      ...comment,
      publishedAt: comment.publishedAt || new Date().toISOString(),
      sentiment: (["Positive", "Negative", "Neutral"].includes(result?.sentiment) ? result.sentiment : "Neutral") as Sentiment,
      reasoning: result?.reasoning || "No reasoning provided",
      confidence: result?.confidence || 0,
      keywords: result?.keywords || [],
    };
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route to fetch YouTube comments
  app.post("/api/fetch-comments", async (req, res) => {
    const { videoUrl } = req.body;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!videoUrl) {
      return res.status(400).json({ error: "Video URL is required" });
    }

    // Extract video ID from URL or accept it directly
    const videoIdMatch = videoUrl.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    let videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId && videoUrl.match(/^[a-zA-Z0-9_-]{11}$/)) {
      videoId = videoUrl;
    }

    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL or Video ID" });
    }

    if (!apiKey || apiKey === "MY_YOUTUBE_API_KEY") {
      // Mock data for demo if no API key is provided
      console.log("Using mock data because YOUTUBE_API_KEY is not set. Run: npm run setup");
      const now = Date.now();
      return res.json({
        comments: [
          { id: "1", text: "This video was so helpful, thank you!", author: "User A", publishedAt: new Date(now - 86400000 * 10).toISOString() },
          { id: "2", text: "I don't really agree with the points made here.", author: "User B", publishedAt: new Date(now - 86400000 * 9).toISOString() },
          { id: "3", text: "Great content as always!", author: "User C", publishedAt: new Date(now - 86400000 * 8).toISOString() },
          { id: "4", text: "Waste of time, honestly.", author: "User D", publishedAt: new Date(now - 86400000 * 7).toISOString() },
          { id: "5", text: "Can you make a video on Python next?", author: "User E", publishedAt: new Date(now - 86400000 * 6).toISOString() },
          { id: "6", text: "The editing is top notch!", author: "User F", publishedAt: new Date(now - 86400000 * 5).toISOString() },
          { id: "7", text: "I'm confused about the second part.", author: "User G", publishedAt: new Date(now - 86400000 * 4).toISOString() },
          { id: "8", text: "Absolutely amazing work!", author: "User H", publishedAt: new Date(now - 86400000 * 3).toISOString() },
          { id: "9", text: "Not my cup of tea.", author: "User I", publishedAt: new Date(now - 86400000 * 2).toISOString() },
          { id: "10", text: "Keep it up!", author: "User J", publishedAt: new Date(now - 86400000).toISOString() },
        ],
        videoId,
        isMock: true
      });
    }

    try {
      const youtube = google.youtube({ version: "v3", auth: apiKey });
      const response = await youtube.commentThreads.list({
        part: ["snippet"],
        videoId: videoId,
        maxResults: 20,
      });

      const comments = response.data.items?.map((item, idx) => ({
        id: item.id || `comment-${idx}`,
        text: cleanText(item.snippet?.topLevelComment?.snippet?.textDisplay || ""),
        author: item.snippet?.topLevelComment?.snippet?.authorDisplayName || "Anonymous",
        publishedAt: item.snippet?.topLevelComment?.snippet?.publishedAt || new Date().toISOString(),
      })) || [];

      res.json({ comments, videoId, isMock: false });
    } catch (error: any) {
      console.error("YouTube API Error:", error);
      const reason = error?.errors?.[0]?.reason || error?.response?.data?.error?.errors?.[0]?.reason;
      const message =
        reason === "commentsDisabled" ? "Comments are disabled on this video." :
        reason === "videoNotFound" ? "Video not found." :
        reason === "quotaExceeded" ? "YouTube API quota exceeded. Try again later." :
        "Failed to fetch comments from YouTube API. Check your YOUTUBE_API_KEY.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/analyze-sentiment", async (req, res) => {
    const { comments } = req.body as { comments?: CommentInput[] };

    if (!Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ error: "Comments array is required" });
    }

    try {
      const analyzed = await analyzeWithGemini(comments);
      const usedGemini = Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
      );

      res.json({
        comments: analyzed,
        usedGemini,
      });
    } catch (error) {
      console.error("Sentiment analysis error:", error);
      res.json({
        comments: analyzeWithRules(comments),
        usedGemini: false,
        fallback: true,
      });
    }
  });

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production" || process.argv.includes("--prod");
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
