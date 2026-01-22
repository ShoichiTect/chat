# Chat SDK Nitro Example

A chat bot example using [Chat SDK](https://github.com/vercel/chat) with [Nitro v3](https://v3.nitro.build/) and Vite.

## Features

- **Multi-platform support** - Slack, Discord, Microsoft Teams, Google Chat
- **AI Mode** - Mention the bot with "AI" to enable Claude-powered responses
- **Rich Cards** - Interactive cards with buttons and fields
- **Reactions** - React to messages and get reactions back
- **DM Support** - Private messaging support

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Configuration

Create a `.env` file with the following variables based on which platforms you want to enable:

### Slack

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

### Discord

```env
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...
DISCORD_APPLICATION_ID=...
DISCORD_MENTION_ROLE_IDS=... # Optional, comma-separated
```

### Microsoft Teams

```env
TEAMS_APP_ID=...
TEAMS_APP_PASSWORD=...
TEAMS_APP_TENANT_ID=...
```

### Google Chat

```env
GOOGLE_CHAT_CREDENTIALS={"type":"service_account",...}
GOOGLE_CHAT_PUBSUB_TOPIC=... # Optional
GOOGLE_CHAT_IMPERSONATE_USER=... # Optional
```

### State & AI

```env
REDIS_URL=redis://localhost:6379
BOT_USERNAME=mybot
```

## Webhook Endpoints

Each platform has its own webhook endpoint:

- **Slack**: `/api/webhooks/slack`
- **Discord**: `/api/webhooks/discord`
- **Teams**: `/api/webhooks/teams`
- **Google Chat**: `/api/webhooks/gchat`

## Deploying

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

See the [Nitro deployment docs](https://v3.nitro.build/deploy) for deployment options.
