import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const NEWS_RSS_URLS = [
  "https://news.google.com/rss/search?q=Neymar%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
  "https://news.google.com/rss/search?q=Neymar%20when%3A1d&hl=pt-BR&gl=BR&ceid=BR%3Apt-419"
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

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
  const news = await fetchRecentNeymarNews();
  const matchedSources = findInjuryRelatedNews(news);
  const injured = matchedSources.length > 0;

  return {
    checkedAt: new Date().toISOString(),
    newsCount: news.length,
    injured,
    result: injured ? "Yes" : "No",
    matchedSources,
    sources: news
  };
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

function findInjuryRelatedNews(news) {
  const injuryPattern =
    /\b(injury|injured|lesion|tear|sprain|strain|medical|muscle|thigh|knee|ankle|hamstring|lesao|lesão|lesionado|machucado|contusao|contusão|desfalque|departamento medico|departamento médico|sentiu dores|recuperacao|recuperação)\b/i;

  return news.filter((item) => injuryPattern.test(`${item.title} ${item.snippet}`));
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
