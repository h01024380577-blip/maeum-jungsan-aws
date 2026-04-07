# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**마음정산 (HeartBook)** — A Korean ceremonial event (경조사) management app for tracking monetary gifts given/received at weddings, funerals, birthdays, etc. Built as an **Apps-in-Toss** mini-app deployed on the Toss platform.

Key features: AI-powered invitation URL parsing (Gemini 2.5 Flash), CSV bulk import, contact management, statistics, Toss social login.

## Commands

- **Dev server:** `npm run dev` (runs `granite dev` — Apps-in-Toss dev wrapper around `next dev`)
- **Build (Next.js only):** `npm run build:next` (runs `prisma generate && next build`)
- **Build (Toss platform):** `npm run build` (runs `granite build`)
- **Lint:** `npm run lint`
- **Tests:** `npx vitest run` (or `npx vitest` for watch mode)
- **Run a single test file:** `npx vitest run src/lib/parseUrl.test.ts`
- **After `npm install`:** `prisma generate` runs automatically via `postinstall`

## Architecture

### Platform: Apps-in-Toss (`@apps-in-toss/web-framework`)

This is **not** a standard Next.js or Vercel app. It's a Toss mini-app configured in `granite.config.ts`. The `granite` CLI wraps Next.js dev/build. The app requests permissions: `CLIPBOARD` (read/write), `CONTACTS` (read).

### Authentication

Two-tier user identity system used by all API routes:
1. **Toss login (priority):** `toss_user_id` cookie set after calling `appLogin()` from `@apps-in-toss/web-framework`. Client-side: `src/lib/tossAuth.ts`. Server-side helper: `src/lib/apiAuth.ts` (`getAuthenticatedUserId()`).
2. **Guest / device ID (fallback):** `x-user-id` request header, populated by `getUserId()` in `src/store/useStore.ts`. Resolution order: Toss cookie → `@apps-in-toss/web-framework` `getDeviceId()` → `localStorage`.

API routes in `app/api/entries/route.ts` and `app/api/contacts/route.ts` check `toss_user_id` cookie first, then `x-user-id` header. Unauthenticated requests with neither are rejected (401). Guest saves auto-upsert a `User` row.

### Data Layer: Prisma 6 + PostgreSQL

All persistent data goes through **Prisma 6** (`prisma/schema.prisma`) → PostgreSQL:

- `User` — identified by Toss user key or device ID (cuid primary key)
- `Contact` — belongs to User
- `Event` — the ceremonial event (wedding/funeral/birthday/other), belongs to User + Contact
- `Transaction` — the monetary record (EXPENSE/INCOME), belongs to Event + User

`Event.uiTheme` (`DEFAULT` | `SOLEMN`) controls funeral visual styling. `Event.confidence` (`HIGH`|`MEDIUM`|`LOW`) comes from AI parsing quality.

> **Important:** Prisma 7 is broken on Vercel serverless (missing `.prisma/client/default`). Stay on **Prisma 6**.

The Zustand store method is still named `loadFromSupabase` for historical reasons but it now calls `/api/entries` and `/api/contacts` API routes — there is no Supabase client-side SDK in use.

### State Management

`src/store/useStore.ts` — single Zustand store (no persistence middleware). All CRUD methods are async and call Next.js API routes. The store holds the canonical client-side state: `entries`, `contacts`, `analysisResult`.

`analysisResult` is a sub-object tracking the AI parsing UI state: `{ data, initialData, showBottomSheet, isParsing, selectedImage }`.

### Routing & Pages

Next.js App Router. All tab pages are client components (`'use client'`):

- `app/page.tsx` → `src/tabs/HomeTab.tsx` (AI input, stats summary, Toss login button)
- `app/calendar/page.tsx` → `src/tabs/CalendarTab.tsx`
- `app/history/page.tsx` → `src/tabs/HistoryTab.tsx`
- `app/contacts/page.tsx` → `src/tabs/ContactsTab.tsx`
- `app/stats/page.tsx` → `src/tabs/StatisticsTab.tsx`
- `app/intro/page.tsx` — onboarding screen
- `app/terms/page.tsx` — static terms of service page (server component, no auth required)

`components/Layout.tsx` — mobile-first shell (430px max-width) with bottom tab navigation.

### API Routes

All in `app/api/`:

- `GET|POST|PATCH|DELETE /api/entries` — Event + Transaction CRUD (Prisma)
- `GET|POST|PATCH /api/contacts` — Contact CRUD (Prisma)
- `POST /api/parse-url` — 3-phase AI invitation URL parser (see below)
- `POST /api/analyze` — AI image/text analysis
- `GET|POST /api/events` — Prisma-based events (separate from entries; partially wired)

### AI URL Parsing Pipeline (`app/api/parse-url/route.ts`)

3-phase fallback pipeline for extracting event data from Korean invitation URLs:

1. **Phase 1 (og + body):** Server fetches HTML → `cheerio` extracts og metatags + body text → Gemini 2.5 Flash analyzes via `@google/genai` SDK
2. **Phase 2 (Jina Reader):** `r.jina.ai/{url}` fetches JS-rendered text for SPAs → Gemini analyzes
3. **Phase 3 (urlContext):** Gemini's native URL fetch tool as last resort

Returns `{ success, data, confidence: 'high'|'medium'|'low', source }`. Gemini 429/rate-limit errors return `reason: 'rate_limit'` for a user-friendly toast.

Parsing utilities: `src/lib/parseUrl.ts` (cheerio extraction functions), `src/lib/fetchPage.ts` (HTML fetching).

### Testing

Vitest (`vitest.config.ts`). Path alias `@` → project root. Test files live alongside source:
- `src/lib/parseUrl.test.ts` — 13 tests for HTML extraction functions
- `src/lib/fetchPage.test.ts` — 7 tests
- `src/lib/events.test.ts` — 9 tests for Prisma event helpers
- `src/hooks/useEvents.test.ts`

### Key Source Files

Beyond the API routes and tab pages, notable files in `src/`:
- `src/lib/tossPayFetch.ts` — Toss Pay API fetch helpers
- `src/lib/events.ts` — Prisma event helper functions (used by `/api/events`)
- `src/hooks/useEvents.ts` — React hook wrapping event CRUD
- `src/utils/csvParser.ts` — CSV parsing for bulk import (uses `papaparse`)
- `src/utils/nanoBananaDocs.ts` — internal documentation/utility
- `src/components/BulkImportModal.tsx` — CSV bulk import UI
- `src/components/ContactDetail.tsx` — contact detail view

### Key Dependencies

- `@google/genai` v1.x — Google GenAI SDK (used in `app/api/parse-url/` and `app/api/analyze/`; note: this is the new SDK, not `@google/generative-ai`)
- `cheerio` — HTML parsing for Phase 1 of the URL pipeline (og tags + body text extraction)
- `@toss/tds-mobile` — Toss Design System mobile components
- `sonner` — toast notification library
- `recharts` — charts used in `StatisticsTab`
- `papaparse` — CSV parsing
- `swr` — client-side data fetching
- `react-calendar` — calendar component in `CalendarTab`
- `framer-motion` / `motion` — animations

### Environment Variables

See `.env.production.example` for the canonical list:
- `DATABASE_URL` — PostgreSQL connection string (Prisma)
- `GEMINI_API_KEY` — Server-only Gemini API key (never use `NEXT_PUBLIC_GEMINI_API_KEY` in production)
- `TOSS_CLIENT_ID` / `TOSS_CLIENT_SECRET` — Toss login credentials
- `TOSS_DECRYPT_KEY` / `TOSS_DECRYPT_AAD` — AES-256 decryption for Toss auth tokens

### Language

UI is entirely in Korean. All user-facing strings, labels, and AI prompts are Korean.

## Known Constraints

- Prisma 6 is pinned — do not upgrade to Prisma 7 (Vercel serverless module resolution bug)
- `Gemini urlContext` tool is incompatible with `responseMimeType: 'application/json'` — Phase 3 omits the MIME type
- `prisma db push` will drop `entries`/`contacts` Supabase tables if they exist alongside — use `prisma migrate` carefully
- Build output goes to `dist/` (not `.next/`) — configured via `distDir: 'dist'` in `next.config.ts`
