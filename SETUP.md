# Setup Instructions

## Initial Setup

### Set Bot Commands

To enable command autocomplete in Telegram (when user types "/"), run:

```bash
pnpm setup:commands
```

This sets up the command menu with:
- `/start` - Register and get started
- `/lesson` - Start a new lesson with topic selection
- `/status` - Check today's progress
- `/reset` - Reset current lesson and start over

You only need to run this once (or when you add new commands).

## Development vs Production

### Local Development (Polling Mode)

For local testing with polling, first **delete the webhook**:

```bash
curl -X POST "https://api.telegram.org/bot6749954594:AAErEBGIl-K2InpWPKfvhNwxIQaD0DHsKh0/deleteWebhook"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was deleted"}
```

Then run the local bot:
```bash
pnpm dev:local
```

### Production (Webhook Mode)

After deploying to Vercel, set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot6749954594:AAErEBGIl-K2InpWPKfvhNwxIQaD0DHsKh0/setWebhook?url=https://your-dutch-bot.vercel.app/api/webhook"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Verify Webhook Status

To check current webhook configuration:

```bash
curl "https://api.telegram.org/bot6749954594:AAErEBGIl-K2InpWPKfvhNwxIQaD0DHsKh0/getWebhookInfo"
```

## Workflow Summary

**Switching to local development:**
1. Delete webhook
2. Run `pnpm dev:local`

**Switching to production:**
1. Stop local bot (Ctrl+C)
2. Deploy to Vercel
3. Set webhook (only needed once or if URL changes)

## Notes

- The webhook persists even after redeployments
- You must delete the webhook before local polling will work
- Only one mode can be active at a time (webhook OR polling)
