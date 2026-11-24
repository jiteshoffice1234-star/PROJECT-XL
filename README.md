<div align="center">

# PROJECT XL

**A modern TypeScript web app — fast, clean, built with Vite.**

![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-ready-000000?logo=bun&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## About

PROJECT XL is a lightweight TypeScript web application built on Vite with a small Node/Bun server for local development and API routes. No bloat, no framework overhead — just a fast dev loop and clean code.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript |
| Bundler / Dev server | Vite |
| Runtime | Bun (Node compatible) |
| Backend | Lightweight `server.ts` |

## Getting Started

```bash
# install dependencies
bun install

# start the dev server
bun run dev

# build for production
bun run build
```

## Configuration

Copy the example environment file and fill in your own values:

```bash
cp .env.example .env
```

> `.env` is git-ignored. Never commit real keys.

## Project Structure

```
PROJECT-XL/
├── src/                # application source
├── index.html          # entry HTML
├── server.ts          # local server / API routes
├── vite.config.ts     # Vite configuration
├── metadata.json      # project metadata
├── tsconfig.json      # TypeScript config
└── .env.example       # environment template
```

## License

MIT
