# UmaCore Web

<div align="center">

**Web dashboard for the UmaCore club quota tracker**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Ko-Fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?style=flat-square&logo=ko-fi)](https://ko-fi.com/harukidev)

</div>

## Overview

Web dashboard companion for [UmaCore](https://github.com/oHaruki/UmaCore). Provides a visual interface for monitoring club quota progress, managing members, configuring club settings, and manually adjusting quota requirements — all backed by the same PostgreSQL database the bot uses.

> **Requires a running UmaCore bot instance.** The web app shares the bot's database and calls its internal API for sync and recalculation operations.

## Features

- **Dashboard overview** — at-a-glance club stats, at-risk members, and recent quota history
- **Quota history** — filterable table of daily fan counts, expected values, and surplus/deficit per member
- **Member management** — view, activate, and deactivate members
- **Bomb tracker** — live view of active bomb warnings and countdowns
- **Club settings** — edit quota, period, scrape schedule, and Discord channels without touching the bot
- **Quota change timeline** — visual month timeline of quota requirement changes; add or remove entries with automatic recalculation
- **Discord login** — authentication via Discord OAuth so only your server's admins can access the dashboard

## Setup

### Prerequisites
- Node.js 18 or higher
- A running [UmaCore](https://github.com/oHaruki/UmaCore) bot (shares the same database)
- Discord OAuth application ([Discord Developer Portal](https://discord.com/developers/applications))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/oHaruki/UmaCore-web.git
   cd UmaCore-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.local.example` to `.env.local` and fill in the values:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/dbname

   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret

   AUTH_SECRET=                  # generate with: npx auth secret
   NEXTAUTH_URL=http://localhost:3000

   # Comma-separated Discord user IDs that are allowed to log in.
   # Right-click your username in Discord (Developer Mode on) to copy your ID.
   ALLOWED_DISCORD_IDS=your_discord_id,other_admin_id
   ```

4. **Set up Discord OAuth**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your bot application (or create a new one)
   - Under **OAuth2**, add a redirect URI: `http://localhost:3000/api/auth/callback/discord`
   - Copy the Client ID and Client Secret into `.env.local`

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Bot API Connection

The web app calls the UmaCore bot's internal HTTP API (default: `http://127.0.0.1:7890`) for operations like syncing club data and recalculating quota history. The bot must be running on the same machine, or `BOT_API_URL` must be set to point to wherever the bot is running:

```env
BOT_API_URL=http://127.0.0.1:7890
```

This is only needed if you change the bot's API port or run them on separate hosts.

## Deployment

### Vercel (recommended)

The easiest way to deploy is Vercel — it handles Next.js natively.

1. Push your repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables from `.env.local` in the Vercel project settings
4. Update `NEXTAUTH_URL` to your production URL
5. Update the Discord OAuth redirect URI to match your production URL

> Note: `BOT_API_URL` points to `127.0.0.1` by default, so the bot and web app need to run on the same host unless you expose the bot API differently.

### Self-hosted

```bash
npm run build
npm start
```

Or with PM2:
```bash
pm2 start npm --name umacore-web -- start
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/            # Login page
│   ├── (dashboard)/       # Protected dashboard pages
│   │   └── dashboard/
│   │       ├── page.tsx           # Overview
│   │       ├── quota/             # Quota history table
│   │       ├── members/           # Member list & detail
│   │       ├── bombs/             # Active bomb warnings
│   │       ├── reports/           # Manual sync trigger
│   │       └── settings/          # Club configuration & quota timeline
│   └── api/               # API routes
│       ├── auth/           # NextAuth handlers
│       ├── clubs/          # Club CRUD
│       ├── members/        # Member management
│       ├── quota-requirements/    # Quota change management
│       └── sync/           # Proxy to bot sync API
├── components/            # Shared UI components
└── lib/
    ├── auth.ts            # NextAuth config
    └── db.ts              # PostgreSQL client
```

## Support the Project

[![Ko-Fi Support](https://img.shields.io/badge/Buy%20me%20a%20coffee-Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/harukidev)

## License

MIT License — see the [LICENSE](LICENSE) file for details.
