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
const ARTICLE_FETCH_LIMIT = Number(process.env.ARTICLE_FETCH_LIMIT || 12);
const ARTICLE_FETCH_TIMEOUT_MS = Number(process.env.ARTICLE_FETCH_TIMEOUT_MS || 4500);
const GROQ_TITLE_CHAR_LIMIT = 140;
const GROQ_SNIPPET_CHAR_LIMIT = 220;
const GROQ_ARTICLE_TEXT_CHAR_LIMIT = 700;
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
  "vetado",
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
  const verdict = await askGroqForInjuryStatus(news, language);
  const sources = decorateNews(news, verdict);
  const matchedSources = sources.filter((source) => source.injuryRelated);
  const injured = verdict.injured;
  const validatedInjury = cleanText(verdict.validatedInjury || (injured ? inferValidatedInjury(news) : "") || "");

  const payload = {
    checkedAt: new Date().toISOString(),
    language,
    newsCount: sources.length,
    injured,
    result: injured ? "Yes" : "No",
    validatedInjury: injured ? validatedInjury : "",
    explanation: cleanText(verdict.explanation || ""),
    confidence: cleanText(verdict.confidence || "unknown"),
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

  return enrichNewsWithArticleText(dedupeNews(items).slice(0, 30));
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
        truncateText(entry.item.snippet, GROQ_SNIPPET_CHAR_LIMIT),
        truncateText(entry.item.articleText, GROQ_ARTICLE_TEXT_CHAR_LIMIT)
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
            "Sports news analyst. Decide if recent items prove Neymar is currently injured right now. Use only direct, current evidence. If recent evidence says he played, started, came off the bench, returned to action, trained normally, or was available for a match, treat that as evidence against a current injury unless another item clearly says he got injured after that appearance. Ignore old history, vague fitness doubts, selection news, contract news, and unrelated uses of out/miss. Translate user text to the target language. Return JSON only. No HTML, XML, Markdown, or styling tags."
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
Set injured=false when evidence is unclear, old, contradictory, or only about selection/return. If injured=false, validatedInjury must be empty and sourceIndexes must be empty.

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
  const injured = Boolean(parsed.injured);

  return {
    injured,
    validatedInjury: injured && typeof parsed.validatedInjury === "string" ? parsed.validatedInjury : "",
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    sourceIndexes: injured && Array.isArray(parsed.sourceIndexes) ? parsed.sourceIndexes : []
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
  const shouldUseHeuristics = verdict.injured && injuryIndexes.size === 0;

  return news.map((item, index) => {
    const sourceIndex = index + 1;
    const { articleText, ...publicItem } = item;

    return {
      ...publicItem,
      injuryRelated: injuryIndexes.has(sourceIndex) || (shouldUseHeuristics && hasCurrentInjurySignal(item))
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
  const text = normalizeSearchText(`${item.title} ${item.snippet} ${item.articleText}`);
  const signalCount = INJURY_SIGNAL_TERMS.reduce(
    (total, term) => total + (text.includes(normalizeSearchText(term)) ? 1 : 0),
    0
  );

  return signalCount * 1000 + Math.max(0, 100 - index);
}

function hasCurrentInjurySignal(item) {
  const title = normalizeSearchText(item.title);
  const text = normalizeSearchText(`${item.title} ${item.snippet} ${item.articleText}`);

  if (isHistoricalInjuryContext(title)) {
    return false;
  }

  if (hasRecentAvailabilitySignal(text)) {
    return false;
  }

  const injuryPart = "(?:lesao|contusao|machucado|lesionado|contundido|vetado|sem condicoes? de jogo|nao tem condicao de jogo)";
  const bodyPart = "(?:panturrilha|coxa|joelho|tornozelo|muscular|grau\\s*[123])";
  const patterns = [
    new RegExp(`\\bneymar\\b.{0,180}\\b${injuryPart}\\b`),
    new RegExp(`\\bneymar\\b.{0,220}\\b(?:lesao|contusao)\\b.{0,90}\\b${bodyPart}\\b`),
    new RegExp(`\\b(?:lesao|contusao)\\b.{0,90}\\b${bodyPart}\\b.{0,220}\\bneymar\\b`),
    /\b(?:prazo de recuperacao|departamento medico|tratamento)\b.{0,220}\bneymar\b/
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function isHistoricalInjuryContext(title) {
  return /\b(?:relembre|historia|trajetoria|2014|2018|2022|2023|2024|2025)\b/.test(title);
}

function hasRecentAvailabilitySignal(text) {
  const appearancePart =
    "(?:jogou|atuou|foi titular|comecou jogando|entrou em campo|participou|disputou|estreou|retornou aos gramados|voltou a jogar|played|started|featured|came off the bench|returned to action|back in action|fit to play|fit again|available for|available to play)";
  const readinessPart =
    "(?:treinou normalmente|treinando normalmente|a disposicao|liberado pelo departamento medico|sem restricoes|fit enough to play|fully available)";
  const patterns = [
    new RegExp(`\\bneymar\\b.{0,180}\\b${appearancePart}\\b`),
    new RegExp(`\\b${appearancePart}\\b.{0,180}\\bneymar\\b`),
    new RegExp(`\\bneymar\\b.{0,180}\\b${readinessPart}\\b`),
    new RegExp(`\\b${readinessPart}\\b.{0,180}\\bneymar\\b`)
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function inferValidatedInjury(news) {
  const text = normalizeSearchText(news.map((item) => `${item.title} ${item.snippet} ${item.articleText}`).join(" "));

  if (/\blesao\b.{0,80}\bpanturrilha\b|\bpanturrilha\b.{0,80}\blesao\b|\bcontusao\b.{0,80}\bpanturrilha\b/.test(text)) {
    return "lesão na panturrilha";
  }

  return "";
}

async function enrichNewsWithArticleText(items) {
  const enriched = [...items];
  const articleTextResults = await Promise.allSettled(
    items.slice(0, ARTICLE_FETCH_LIMIT).map((item) => fetchArticleText(item.link))
  );

  for (const [index, result] of articleTextResults.entries()) {
    if (result.status === "fulfilled" && result.value) {
      enriched[index] = {
        ...enriched[index],
        link: result.value.link,
        articleText: result.value.text
      };
    }
  }

  return enriched;
}

async function fetchArticleText(link) {
  if (!link) {
    return null;
  }

  const articleLink = await resolveGoogleNewsUrl(link);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(articleLink, {
      headers: {
        "User-Agent": "Mozilla/5.0 NeymarInjuryRadar/1.0",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return null;
    }

    const text = extractArticleText(await response.text());

    return text
      ? {
          link: articleLink,
          text
        }
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveGoogleNewsUrl(link) {
  if (!isGoogleNewsArticleUrl(link)) {
    return link;
  }

  try {
    const base64String = getGoogleNewsBase64String(link);
    const params = await fetchGoogleNewsDecodingParams(base64String);
    return (await decodeGoogleNewsUrl(params)) || link;
  } catch {
    return link;
  }
}

function isGoogleNewsArticleUrl(link) {
  try {
    const url = new URL(link);
    return url.hostname === "news.google.com" && /\/(?:rss\/)?(?:articles|read)\//.test(url.pathname);
  } catch {
    return false;
  }
}

function getGoogleNewsBase64String(link) {
  const url = new URL(link);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

async function fetchGoogleNewsDecodingParams(base64String) {
  const urls = [
    `https://news.google.com/articles/${base64String}`,
    `https://news.google.com/rss/articles/${base64String}`
  ];

  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 NeymarInjuryRadar/1.0"
      }
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const signature = html.match(/\sdata-n-a-sg=["']([^"']+)["']/i)?.[1];
    const timestamp = html.match(/\sdata-n-a-ts=["']([^"']+)["']/i)?.[1];

    if (signature && timestamp) {
      return {
        base64String,
        signature,
        timestamp
      };
    }
  }

  throw new Error("Unable to resolve Google News article URL.");
}

async function decodeGoogleNewsUrl({ base64String, signature, timestamp }) {
  const payload = [
    "Fbv4je",
    JSON.stringify([
      "garturlreq",
      [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      base64String,
      Number(timestamp),
      signature
    ])
  ];
  const body = new URLSearchParams({
    "f.req": JSON.stringify([[payload]])
  });
  const response = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Mozilla/5.0 NeymarInjuryRadar/1.0"
    },
    body
  });

  if (!response.ok) {
    return "";
  }

  const text = await response.text();
  const jsonLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("[["));

  if (!jsonLine) {
    return "";
  }

  const parsed = JSON.parse(jsonLine);
  const decodedPayload = JSON.parse(parsed?.[0]?.[2] || "[]");
  return typeof decodedPayload?.[1] === "string" ? decodedPayload[1] : "";
}

function extractArticleText(html) {
  const jsonLdArticleBodies = readJsonLdArticleBodies(html);
  const metaDescriptions = [
    readMetaContent(html, "description"),
    readMetaContent(html, "og:description"),
    readMetaContent(html, "twitter:description")
  ];
  const visibleArticleText = readVisibleArticleText(html);

  return cleanText([...jsonLdArticleBodies, ...metaDescriptions, visibleArticleText].filter(Boolean).join(" "));
}

function readJsonLdArticleBodies(html) {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  const articleBodies = [];

  for (const [, rawJson] of scripts) {
    const text = rawJson.replaceAll("<![CDATA[", "").replaceAll("]]>", "");

    try {
      collectJsonLdArticleBodies(JSON.parse(text), articleBodies);
    } catch {
      // Some publishers ship malformed JSON-LD; visible text extraction still covers those pages.
    }
  }

  return articleBodies;
}

function collectJsonLdArticleBodies(value, articleBodies) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdArticleBodies(item, articleBodies);
    }

    return;
  }

  if (typeof value.articleBody === "string") {
    articleBodies.push(value.articleBody);
  }

  for (const key of ["@graph", "mainEntity", "mainEntityOfPage"]) {
    collectJsonLdArticleBodies(value[key], articleBodies);
  }
}

function readMetaContent(html, name) {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escapedName}["'][^>]*>`, "i"),
    new RegExp(`<meta\\s+[^>]*content=["'][^"']*["'][^>]*(?:name|property)=["']${escapedName}["'][^>]*>`, "i")
  ];
  const tag = patterns.map((pattern) => html.match(pattern)?.[0]).find(Boolean);

  if (!tag) {
    return "";
  }

  const content = tag.match(/\scontent=["']([^"']*)["']/i)?.[1] || "";
  return decodeXml(content);
}

function readVisibleArticleText(html) {
  const scopedHtml =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html;
  const paragraphText = [...scopedHtml.matchAll(/<(?:p|h1|h2)[^>]*>([\s\S]*?)<\/(?:p|h1|h2)>/gi)]
    .map(([, text]) => stripHtml(text))
    .join(" ");

  return decodeXml(paragraphText);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
