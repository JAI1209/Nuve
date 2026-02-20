# Nuve Player

Nuve Player is a React + TypeScript music/video player app built with Vite and Redux Toolkit.

## Tech Stack

- React 18
- TypeScript
- Redux Toolkit
- Vite
- json-server (mock API)

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Set required values in `.env`:

- `VITE_YOUTUBE_API_KEY` (required)
- `VITE_API_BASE_URL` (optional, defaults to `http://localhost:3001`)
- `VITE_USER_ID` (optional, defaults to `demo-user-1`)

## Run Locally

Start the frontend:

```bash
npm run dev
```

Start mock backend API:

```bash
npm run api
```

The app and API should run in separate terminals.

## Build

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Project Notes

- Local mock data is in `db.json`.
- `.env` is ignored by git for security.
- Do not commit real API keys.
