# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint with Next.js ESLint
- `npm start` — start production server

No test framework is configured.

## Environment

Requires `.env.local` with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for the Turso (libSQL) database.

## Architecture

Next.js 15 App Router application (single-page) with Turso/libSQL database backend. All UI is client-side (`'use client'`) with SWR for data fetching.

**Database layer** (`src/lib/db/`): Two modules — `clipboard.ts` and `auth.ts` — each create their own `@libsql/client` instance and auto-initialize schemas on first use via lazy `initSchema()`/`initAuthSchema()` calls. Tables: `clipboard_items`, `users`, `auth_tokens`. Timestamps are stored as epoch milliseconds (`Date.now()`).

**Auth**: Token-based (Bearer tokens in Authorization header). `AuthContext` manages client-side state with localStorage persistence. Token verification happens on mount via `/api/auth/verify`. Auth middleware in `src/lib/auth/middleware.ts` extracts and verifies tokens for API routes. All clipboard API endpoints require authentication.

**API routes** (`src/app/api/`):
- `/api/clipboard` — GET (list with pagination/filter) and POST (create, max 100K chars, auto-cleanup at 10K items)
- `/api/clipboard/[id]` — GET and DELETE
- `/api/auth/{login,register,logout,verify}` — auth endpoints

**Route params**: Next.js 15 async params pattern — `{ params }: { params: Promise<{ id: string }> }` with `await params`.

**Frontend**: Single page (`src/app/page.tsx`) with auth gate. Components in `src/components/` split into `auth/` and `clipboard/` subdirectories. Clipboard items support `text/plain` and `text/code` content types (code items require a `language` field). Uses react-markdown with remark-gfm and react-syntax-highlighter for rendering.

## Code Style

- Prettier: single quotes, semicolons, trailing commas (es5), 2-space indent, 100 char width, arrow parens avoid
- Path alias: `@/*` maps to `./src/*`
- TypeScript strict mode enabled
