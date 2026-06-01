# Neymar Injury Radar

A small web app that checks Neymar news from the last 24 hours, lists recent articles, and displays a large `Yes` or `No` injury signal.

## Run

```bash
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## How It Works

- The server reads English/US and Portuguese/Brazil Google News RSS results for `Neymar when:1d`.
- It enriches recent RSS items with short article-body excerpts, then asks Groq to verify whether the evidence proves a current injury.
- It shows `Yes` on a red background when injury-related terms are found, otherwise `No` on a green background.
- The UI detects the browser/system language on first load and can be changed with the language selector.

## Environment

- `HOST`: optional, defaults to `127.0.0.1`.
- `PORT`: optional, defaults to `3000`.
- `ARTICLE_FETCH_LIMIT`: optional, defaults to `12` recent articles.
- `ARTICLE_FETCH_TIMEOUT_MS`: optional, defaults to `4500`.
