# Online Clipboard

A small Next.js app for sharing clipboard content and transferring files between devices.

## Features

- Account registration and login
- Authenticated clipboard history
- Plain text and code snippets
- Syntax highlighting for code
- Markdown rendering
- Manual JSON beautify toggle for valid JSON content
- Device-to-device file transfer with progress display

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- SWR
- Turso/libSQL

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local` in the project root:

```bash
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Available Scripts

```bash
npm run dev
npm run build
npm start
npm run lint
```

## Project Structure

```text
src/app/             Next.js pages and API routes
src/components/      UI components
src/contexts/        React context providers
src/hooks/           Client-side hooks
src/lib/             Database and auth utilities
src/types/           Shared TypeScript types
```

## Notes

- Clipboard API routes require a Bearer token.
- Database tables are initialized lazily on first use.
- No test framework is currently configured.
