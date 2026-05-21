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
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const CACHE_TTL_MS = 60 * 60 * 1000;
const GROQ_NEWS_ITEM_LIMIT = Number(process.env.GROQ_NEWS_ITEM_LIMIT || 14);
const GROQ_MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS || 450);
const GROQ_TITLE_CHAR_LIMIT = 140;
const GROQ_SNIPPET_CHAR_LIMIT = 160;
const GROQ_SOURCE_CHAR_LIMIT = 45;
const INJURY_SIGNAL_TERMS = [
  "injury",
  "injured",
  "calf",
  "thigh",
  "knee",
  "ankle",
  "foot",
  "hamstring",
  "muscle",
  "rupture",
  "sprain",
  "sidelined",
  "unavailable",
  "recovering",
  "rehab",
  "lesao",
  "lesionado",
  "contusao",
  "machucado",
  "panturrilha",
  "coxa",
  "joelho",
  "tornozelo",
  "muscular",
  "desfalque",
  "recupera",
  "lesion",
  "lesionado",
  "pantorrilla",
  "muslo",
  "rodilla",
  "tobillo",
  "blessure",
  "blesse",
  "mollet",
  "cuisse",
  "genou",
  "cheville",
  "forfait",
  "verletzung",
  "verletzt",
  "wade",
  "knie",
  "knochel",
  "muskel"
];
const SUPPORTED_LANGUAGES = {
  en: "English",
  zh: "Chinese",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  ar: "Arabic",
  bn: "Bengali",
  pt: "Portuguese",
  ru: "Russian",
  ur: "Urdu",
  id: "Indonesian",
  de: "German",
  ja: "Japanese"
};
const NEWS_LOCALES = {
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
  zh: { hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant" },
  hi: { hl: "hi-IN", gl: "IN", ceid: "IN:hi" },
  es: { hl: "es-ES", gl: "ES", ceid: "ES:es" },
  fr: { hl: "fr-FR", gl: "FR", ceid: "FR:fr" },
  ar: { hl: "ar", gl: "SA", ceid: "SA:ar" },
  bn: { hl: "bn-BD", gl: "BD", ceid: "BD:bn" },
  pt: { hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" },
  ru: { hl: "ru-RU", gl: "RU", ceid: "RU:ru" },
  ur: { hl: "ur-PK", gl: "PK", ceid: "PK:ur" },
  id: { hl: "id-ID", gl: "ID", ceid: "ID:id" },
  de: { hl: "de-DE", gl: "DE", ceid: "DE:de" },
  ja: { hl: "ja-JP", gl: "JP", ceid: "JP:ja" }
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const statusCache = new Map();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/neymar-status") {
      const language = normalizeLanguage(request.headers["x-user-language"] || request.headers["accept-language"]);
      const payload = await buildNeymarStatus(language);
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

async function buildNeymarStatus(language) {
  const now = Date.now();
  const cached = statusCache.get(language);

  if (cached && now - cached.createdAt < CACHE_TTL_MS) {
    return cached.payload;
  }

  const news = await fetchRecentNeymarNews(language);
  const groqVerdict = await askGroqForInjuryStatus(news, language);
  const sources = decorateNews(news, groqVerdict);
  const matchedSources = sources.filter((source) => source.injuryRelated);

  const payload = {
    checkedAt: new Date().toISOString(),
    language,
    newsCount: sources.length,
    injured: Boolean(groqVerdict.injured),
    result: groqVerdict.injured ? "Yes" : "No",
    validatedInjury: cleanText(groqVerdict.validatedInjury || ""),
    explanation: cleanText(groqVerdict.explanation || ""),
    confidence: cleanText(groqVerdict.confidence || "unknown"),
    matchedSources,
    sources
  };

  statusCache.set(language, {
    createdAt: now,
    payload
  });

  return payload;
}

async function fetchRecentNeymarNews(language) {
  const response = await fetch(buildNewsRssUrl(language), {
    headers: {
      "User-Agent": "Mozilla/5.0 NeymarInjuryRadar/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`News request failed with ${response.status}`);
  }

  const items = parseRssItems(await response.text())
    .map((item) => ({
      title: cleanText(item.title),
      source: cleanText(item.source || ""),
      link: cleanText(item.link),
      publishedAt: cleanText(item.pubDate),
      snippet: cleanText(item.description)
    }))
    .filter((item) => item.title && item.link);

  if (items.length === 0) {
    throw new Error("No news items found.");
  }

  return dedupeNews(items).slice(0, 30);
}

function buildNewsRssUrl(language) {
  const locale = NEWS_LOCALES[language] || NEWS_LOCALES.en;
  const url = new URL("https://news.google.com/rss/search");

  url.searchParams.set("q", "Neymar when:1d");
  url.searchParams.set("hl", locale.hl);
  url.searchParams.set("gl", locale.gl);
  url.searchParams.set("ceid", locale.ceid);

  return url.toString();
}

async function askGroqForInjuryStatus(news, language) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Groq API key is not configured.");
  }

  const languageName = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES.en;
  const newsBlock = prepareNewsForGroq(news)
    .map((entry) =>
      [
        `#${entry.index}`,
        truncateText(entry.item.source || "Unknown", GROQ_SOURCE_CHAR_LIMIT),
        formatGroqDate(entry.item.publishedAt),
        truncateText(entry.item.title, GROQ_TITLE_CHAR_LIMIT),
        truncateText(entry.item.snippet, GROQ_SNIPPET_CHAR_LIMIT)
      ]
        .filter(Boolean)
        .join(" | ")
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
      max_tokens: GROQ_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Sports news analyst. Decide if recent items prove Neymar is currently injured. Use only direct current evidence. Ignore old history, vague fitness doubts, selection news, and unrelated uses of out/miss. Translate user text to the target language. Return JSON only. No HTML, XML, Markdown, or styling tags."
        },
        {
          role: "user",
          content: `Lang: ${languageName}
Return:
{
  "injured": boolean,
  "validatedInjury": "few words in ${languageName}, empty if not proven",
  "confidence": "high" | "medium" | "low",
  "explanation": "one short sentence in ${languageName}",
  "sourceIndexes": [original item numbers that directly support current injury]
}
Set injured=false when evidence is unclear, old, contradictory, or only about selection/return.

News:
${newsBlock}`
        }
      ]
    })
  });

  const bodyText = await response.text();
  const body = parseGroqResponseBody(bodyText, response.status);

  if (!response.ok) {
    const message = body?.error?.message || `Groq request failed with ${response.status}`;
    throw new Error(message);
  }

  try {
    return normalizeGroqVerdict(body?.choices?.[0]?.message?.content);
  } catch {
    throw new Error("Groq returned an invalid analysis response. Please try again shortly.");
  }
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

function parseGroqResponseBody(text, statusCode) {
  try {
    return JSON.parse(text);
  } catch {
    const preview = cleanText(text).slice(0, 220);
    const message = preview
      ? `Groq returned a non-JSON response (${statusCode}): ${preview}`
      : `Groq returned an empty response (${statusCode}).`;

    return {
      error: {
        message
      }
    };
  }
}

function decorateNews(news, verdict) {
  const injuryIndexes = new Set(normalizeSourceIndexes(verdict.sourceIndexes, news.length));

  return news.map((item, index) => {
    const sourceIndex = index + 1;

    return {
      ...item,
      injuryRelated: injuryIndexes.has(sourceIndex)
    };
  });
}

function normalizeSourceIndexes(sourceIndexes, maxIndex) {
  const uniqueIndexes = [...new Set(sourceIndexes)]
    .map((index) => Number(String(index).match(/\d+/)?.[0]))
    .filter((index) => Number.isInteger(index) && index >= 1 && index <= maxIndex);

  return uniqueIndexes;
}

function prepareNewsForGroq(news) {
  return news
    .map((item, index) => ({
      item,
      index: index + 1,
      score: scoreInjuryRelevance(item, index)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, GROQ_NEWS_ITEM_LIMIT)
    .sort((a, b) => a.index - b.index);
}

function scoreInjuryRelevance(item, index) {
  const text = normalizeSearchText(`${item.title} ${item.snippet}`);
  const signalCount = INJURY_SIGNAL_TERMS.reduce(
    (total, term) => total + (text.includes(normalizeSearchText(term)) ? 1 : 0),
    0
  );

  return signalCount * 1000 + Math.max(0, 100 - index);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function formatGroqDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function normalizeLanguage(language) {
  const baseCode = String(language || "en").toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES[baseCode] ? baseCode : "en";
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
  return stripHtml(String(value || "")).replace(/\s+/g, " ").trim();
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
