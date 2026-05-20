import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const CACHE_TTL_MS = 60 * 60 * 1000;
const NEWS_RSS_URLS = [
  "https://news.google.com/rss/search?q=Neymar%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
  "https://news.google.com/rss/search?q=Neymar%20when%3A1d&hl=pt-BR&gl=BR&ceid=BR%3Apt-419"
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

let statusCache = null;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/neymar-status") {
      const payload = await buildNeymarStatus();
      sendJson(response, 200, payload);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, {
      error: "Unable to analyze Neymar news right now.",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Neymar Injury Radar running at http://${HOST}:${PORT}`);
});

async function buildNeymarStatus() {
  const now = Date.now();

  if (statusCache && now - statusCache.createdAt < CACHE_TTL_MS) {
    return statusCache.payload;
  }

  const news = await fetchRecentNeymarNews();
  const groqVerdict = await askGroqForInjuryStatus(news);
  const matchedSources = resolveMatchedSources(news, groqVerdict.sourceIndexes);

  const payload = {
    checkedAt: new Date().toISOString(),
    newsCount: news.length,
    injured: Boolean(groqVerdict.injured),
    result: groqVerdict.injured ? "Yes" : "No",
    validatedInjury: cleanText(groqVerdict.validatedInjury || ""),
    explanation: cleanText(groqVerdict.explanation || ""),
    confidence: cleanText(groqVerdict.confidence || "unknown"),
    matchedSources,
    sources: news
  };

  statusCache = {
    createdAt: now,
    payload
  };

  return payload;
}

async function fetchRecentNeymarNews() {
  const results = await Promise.allSettled(
    NEWS_RSS_URLS.map(async (url) => {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 NeymarInjuryRadar/1.0"
        }
      });

      if (!response.ok) {
        throw new Error(`News request failed with ${response.status}`);
      }

      return parseRssItems(await response.text());
    })
  );

  const items = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .map((item) => ({
      title: cleanText(item.title),
      source: cleanText(item.source || ""),
      link: cleanText(item.link),
      publishedAt: cleanText(item.pubDate),
      snippet: cleanText(item.description)
    }))
    .filter((item) => item.title && item.link);

  if (items.length === 0) {
    const error = results.find((result) => result.status === "rejected")?.reason;
    throw new Error(error instanceof Error ? error.message : "No news items found.");
  }

  return dedupeNews(items).slice(0, 30);
}

async function askGroqForInjuryStatus(news) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Groq API key is not configured.");
  }

  const newsBlock = news
    .map(
      (item, index) =>
        `${index + 1}. Title: ${item.title}\nSource: ${item.source || "Unknown"}\nPublished: ${
          item.publishedAt || "Unknown"
        }\nSnippet: ${item.snippet || "No snippet"}\nLink: ${item.link}`
    )
    .join("\n\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a careful sports news analyst. Decide whether the supplied recent news indicates Neymar is currently injured now. Use only the provided news titles, snippets, sources, dates, and links. Do not infer from old history, generic fitness doubts, emotional stories, or unrelated uses of words like out/miss unless the source clearly says he is currently injured, recovering from an injury, unavailable because of injury, or has a named current injury. Return only valid JSON."
        },
        {
          role: "user",
          content: `Analyze these Neymar news items from the last 24 hours.

Return JSON with this exact shape:
{
  "injured": boolean,
  "validatedInjury": "short current injury or availability status to highlight in red; empty string if not validated",
  "confidence": "high" | "medium" | "low",
  "explanation": "one concise sentence explaining the decision",
  "sourceIndexes": [numbers of the strongest supporting news items]
}

If the evidence is unclear, contradictory, old, about generic fitness doubts, or only says he was selected/returned, set "injured": false and explain that no current injury is validated.

News:
${newsBlock}`
        }
      ]
    })
  });

  const body = await response.json();

  if (!response.ok) {
    const message = body?.error?.message || `Groq request failed with ${response.status}`;
    throw new Error(message);
  }

  return normalizeGroqVerdict(body?.choices?.[0]?.message?.content);
}

function normalizeGroqVerdict(content) {
  const parsed = parseJsonObject(content);

  return {
    injured: Boolean(parsed.injured),
    validatedInjury: typeof parsed.validatedInjury === "string" ? parsed.validatedInjury : "",
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    sourceIndexes: Array.isArray(parsed.sourceIndexes) ? parsed.sourceIndexes : []
  };
}

function parseJsonObject(content = "") {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Groq response did not include valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function resolveMatchedSources(news, sourceIndexes) {
  const uniqueIndexes = [...new Set(sourceIndexes)]
    .map((index) => Number(index))
    .filter((index) => Number.isInteger(index) && index >= 1 && index <= news.length);

  return uniqueIndexes.map((index) => news[index - 1]);
}

function parseRssItems(xml) {
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  return Array.from(itemMatches, ([, itemXml]) => ({
    title: readTag(itemXml, "title"),
    link: readTag(itemXml, "link"),
    pubDate: readTag(itemXml, "pubDate"),
    description: stripHtml(readTag(itemXml, "description")),
    source: readTag(itemXml, "source")
  }));
}

function dedupeNews(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/\W+/g, " ").trim();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function readTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return decodeXml(match?.[1] || "");
}

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, " ");
}

function cleanText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeXml(value) {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

async function serveStatic(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const requestedPath = resolve(join(publicDir, safePath));

  if (!requestedPath.startsWith(publicDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(requestedPath);
    const contentType = mimeTypes[extname(requestedPath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendText(response, 404, "Not found");
      return;
    }

    throw error;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function loadDotEnv() {
  const envPath = resolve(__dirname, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
