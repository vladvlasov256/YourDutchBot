# Daily Push Setup Guide

This guide explains how to enable the daily push feature, which sends an engaging morning message to all users at 08:00 CET.

## What It Does

Every day at 08:00 CET (07:00 UTC in winter, 06:00 UTC in summer), the bot will:
- Check each user's lesson state for today
- Send a personalized message based on their status:
  - **No lesson yet**: Engaging morning message to start a new lesson
  - **Lesson in progress**: Reminder to continue their unfinished lesson
  - **Lesson completed**: Congratulations + optional encouragement for another round
- Rotate through 3 different messages for each category for variety
- Respect Telegram's rate limits with automatic delays

## Prerequisites

1. Bot deployed to Vercel
2. Vercel Pro plan (required for cron jobs) OR Hobby plan (1 cron job allowed)
3. All environment variables configured

## Setup Steps

### 1. Generate CRON_SECRET

Generate a random secret for security (prevents unauthorized access to the endpoint):

```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 2. Add Environment Variable to Vercel

Go to your Vercel project dashboard:
1. Navigate to **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** The random secret you generated above
   - **Environments:** Production, Preview, Development
3. Click **Save**

### 3. Deploy

The cron job is already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/daily-push",
      "schedule": "0 7 * * *"
    }
  ]
}
```

Simply deploy to Vercel:

```bash
git add .
git commit -m "feat: add daily push notification"
git push
```

Vercel will automatically detect the cron configuration and activate it.

### 4. Verify Cron is Active

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Cron Jobs**
3. You should see `/api/daily-push` listed with schedule `0 7 * * *`

## Testing Locally

You can test the daily push endpoint locally:

```bash
# Set CRON_SECRET in your .env file first
curl -X GET http://localhost:3000/api/daily-push \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

Expected response:
```json
{
  "success": true,
  "message": "Daily push completed",
  "stats": {
    "total": 5,
    "sent": 5,
    "failed": 0,
    "breakdown": {
      "newLessons": 3,
      "inProgress": 1,
      "completed": 1
    }
  }
}
```

## Testing in Production

You can manually trigger the cron endpoint:

```bash
curl -X GET https://your-dutch-bot.vercel.app/api/daily-push \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

## Adjusting the Schedule

The cron schedule uses standard cron syntax:

```
"0 7 * * *" = Every day at 07:00 UTC (08:00 CET in winter)
```

To change the time, edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/daily-push",
      "schedule": "0 6 * * *"  // 06:00 UTC = 07:00 CET (summer time)
    }
  ]
}
```

**Note:** Vercel cron uses UTC. Adjust for your timezone:
- Winter (CET = UTC+1): Use UTC hour - 1
- Summer (CEST = UTC+2): Use UTC hour - 2

## Customizing Messages

Edit the messages in `/api/daily-push.ts`. There are three message categories:

```typescript
// For users with no lesson today
const NEW_LESSON_MESSAGES = [
  '☀️ *Goedemorgen!*\n\nReady for your daily Dutch practice?...',
  // Add more messages here
];

// For users with lesson in progress
const IN_PROGRESS_MESSAGES = [
  '👋 *Good morning!*\n\nYou have an unfinished lesson...',
  // Add more messages here
];

// For users who completed today's lesson
const COMPLETED_MESSAGES = [
  '🎉 *Well done!*\n\nYou already completed today\'s lesson!...',
  // Add more messages here
];
```

The bot rotates through these messages based on the day of the month (day % 3).

## Rate Limiting

The endpoint automatically handles Telegram's rate limit (~30 messages/second):
- Adds 35ms delay between each message
- Safely sends to ~28 users per second
- For 100+ users, the entire batch takes ~4 seconds

## Monitoring

Check the Vercel logs to monitor daily push execution:
1. Go to **Deployments** → Select your deployment
2. Click **Functions** → `/api/daily-push`
3. View logs for execution history and stats

## Disabling Daily Push

To temporarily disable:
1. Go to Vercel dashboard → **Settings** → **Cron Jobs**
2. Toggle off the `/api/daily-push` cron job

To permanently remove:
1. Delete the cron configuration from `vercel.json`
2. Redeploy

## Troubleshooting

**Issue:** Cron not executing
- **Solution:** Verify CRON_SECRET is set in Vercel environment variables
- **Solution:** Check Vercel logs for error messages
- **Solution:** Ensure you're on a plan that supports cron jobs

**Issue:** Messages not being sent
- **Solution:** Check Telegram bot token is valid
- **Solution:** Verify users exist in database (use `/start` to register)
- **Solution:** Check Vercel function logs for errors

**Issue:** Wrong timezone
- **Solution:** Adjust cron schedule in `vercel.json` (remember: Vercel uses UTC)
- **Solution:** Account for daylight saving time changes

## Future Enhancements

Potential improvements for daily push:
- [ ] User preferences to opt-out of daily notifications
- [ ] Timezone-aware delivery (send based on user's local time)
- [ ] A/B testing different message styles
- [ ] Skip weekends option
- [ ] Smart timing based on user's activity patterns
