# Setup Instructions

## One-Time Webhook Setup

After deploying to Vercel, run this command **once** to register the webhook:

```bash
curl -X POST "https://api.telegram.org/bot6749954594:AAErEBGIl-K2InpWPKfvhNwxIQaD0DHsKh0/setWebhook?url=https://your-dutch-bot.vercel.app/api/webhook"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Verify Webhook Status

To check if the webhook is set correctly:

```bash
curl "https://api.telegram.org/bot6749954594:AAErEBGIl-K2InpWPKfvhNwxIQaD0DHsKh0/getWebhookInfo"
```

## Notes

- This only needs to be done **once** per bot
- The webhook persists even after redeployments
- Only re-run if you change the domain or webhook path
