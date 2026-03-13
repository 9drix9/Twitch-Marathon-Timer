# Twitch Marathon Timer

A self-hosted marathon / subathon timer overlay for Twitch streams. Displays a countdown that grows when viewers subscribe, donate, cheer bits, or trigger other events.

## Features

- Large HH:MM:SS countdown with glow aesthetic
- Real-time event feed showing who added time
- Transparent overlay for OBS browser source
- Admin panel with pause / resume / add / subtract / reset
- Configurable time rules per event type
- Event deduplication (duplicate webhooks won't add time twice)
- Timer persistence across restarts (SQLite)
- Max timer cap to prevent abuse
- Sound effect on time-added events
- Event simulator for testing without going live
- Twitch EventSub webhook support (subs, bits, follows, raids, channel points)
- StreamElements & Streamlabs donation webhook support

## File Tree

```
├── .env.example            # Environment variable template
├── .gitignore
├── next.config.ts          # Next.js config (externalizes SQLite)
├── package.json
├── tsconfig.json
├── README.md
├── data/                   # Created at runtime — SQLite DB lives here
│   └── marathon.db
└── src/
    ├── config/
    │   └── time-rules.ts   # Default time rules + DB-backed settings
    ├── lib/
    │   ├── auth.ts          # Admin secret verification
    │   ├── db.ts            # SQLite setup + schema
    │   ├── sse.ts           # Server-Sent Events broadcaster
    │   └── timer.ts         # Timer logic + event processing
    └── app/
        ├── globals.css
        ├── layout.tsx
        ├── page.tsx             # Redirects to /admin
        ├── overlay/
        │   └── page.tsx         # OBS overlay (transparent background)
        ├── admin/
        │   └── page.tsx         # Admin control panel
        ├── simulator/
        │   └── page.tsx         # Manual event simulator
        └── api/
            ├── timer/route.ts        # GET/POST timer state
            ├── events/route.ts       # GET recent events
            ├── sse/route.ts          # SSE stream for overlay
            ├── simulate/route.ts     # POST simulated events
            ├── admin/settings/route.ts  # GET/POST time rules
            └── webhooks/
                ├── twitch/route.ts         # Twitch EventSub
                ├── streamelements/route.ts # StreamElements tips
                └── streamlabs/route.ts     # Streamlabs donations
```

## Setup

### 1. Install dependencies

```bash
cd Twitch-Marathon-Timer
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```
ADMIN_SECRET=pick-a-long-random-string
```

Generate one with: `openssl rand -hex 32`

### 3. Run locally

```bash
npm run dev
```

The app starts at **http://localhost:3000**.

### 4. Add overlay to OBS

1. In OBS, add a **Browser Source**
2. URL: `http://localhost:3000/overlay`
3. Width: `1920`, Height: `1080` (or match your canvas)
4. Check **"Custom CSS"** is empty or minimal
5. The background is transparent — the timer floats over your scene

### 5. Open admin panel

Go to `http://localhost:3000/admin` and enter your `ADMIN_SECRET`.

From here you can:
- Pause / Resume the timer
- Add or subtract time manually
- Reset the timer
- Configure time rules (minutes per sub tier, bits, donations, etc.)
- Toggle follow and raid time
- Set the max timer cap

### 6. Test with the simulator

Go to `http://localhost:3000/simulator`, enter your admin secret, and click preset buttons to fire fake events. Watch them appear on the overlay in real time.

---

## Connecting Twitch EventSub

Twitch EventSub requires a **publicly accessible HTTPS URL** for webhooks.

### Steps

1. **Create a Twitch app** at https://dev.twitch.tv/console/apps
   - Set OAuth Redirect URL to `http://localhost:3000` (not used for webhooks, but required)
   - Note your **Client ID** and **Client Secret**

2. **Add to `.env`:**
   ```
   TWITCH_CLIENT_ID=your_client_id
   TWITCH_CLIENT_SECRET=your_client_secret
   TWITCH_WEBHOOK_SECRET=a-random-string-10-to-100-chars
   ```

3. **Expose your server publicly** using one of:
   - [ngrok](https://ngrok.com): `ngrok http 3000` → gives you `https://xxxx.ngrok.io`
   - [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
   - Deploy to a VPS

4. **Get an app access token:**
   ```bash
   curl -X POST "https://id.twitch.tv/oauth2/token" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "grant_type=client_credentials"
   ```

5. **Create EventSub subscriptions** (replace values):
   ```bash
   # Subscribe to channel.subscribe
   curl -X POST "https://api.twitch.tv/helix/eventsub/subscriptions" \
     -H "Authorization: Bearer YOUR_APP_TOKEN" \
     -H "Client-Id: YOUR_CLIENT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "channel.subscribe",
       "version": "1",
       "condition": { "broadcaster_user_id": "YOUR_CHANNEL_ID" },
       "transport": {
         "method": "webhook",
         "callback": "https://YOUR_PUBLIC_URL/api/webhooks/twitch",
         "secret": "YOUR_TWITCH_WEBHOOK_SECRET"
       }
     }'
   ```

   Repeat for these event types:
   - `channel.subscribe` (v1)
   - `channel.subscription.gift` (v1)
   - `channel.cheer` (v1)
   - `channel.follow` (v2 — needs `moderator_user_id` in condition)
   - `channel.raid` (v1 — use `to_broadcaster_user_id`)
   - `channel.channel_points_custom_reward_redemption.add` (v1)

6. Twitch will send a verification challenge to your callback URL. The app handles this automatically.

### Find your channel ID

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Client-Id: YOUR_CLIENT_ID" \
     "https://api.twitch.tv/helix/users?login=YOUR_USERNAME"
```

---

## Connecting StreamElements

1. Go to **StreamElements Dashboard → Account → Channels**
2. Under **Webhook**, set the URL to:
   ```
   https://YOUR_PUBLIC_URL/api/webhooks/streamelements
   ```
3. Copy the webhook secret and add to `.env`:
   ```
   STREAMELEMENTS_WEBHOOK_SECRET=your_se_secret
   ```

Donations (tips) will automatically add time based on your configured rules.

---

## Connecting Streamlabs

1. Go to **Streamlabs Dashboard → Settings → API Settings**
2. Set up a webhook pointing to:
   ```
   https://YOUR_PUBLIC_URL/api/webhooks/streamlabs
   ```
3. Copy the API token / webhook secret and add to `.env`:
   ```
   STREAMLABS_WEBHOOK_SECRET=your_sl_secret
   ```

Supports donations, subscriptions, and bits forwarded through Streamlabs.

---

## Where Secrets Go

| Secret | File | Purpose |
|--------|------|---------|
| `ADMIN_SECRET` | `.env` | Protects admin panel and API |
| `TWITCH_CLIENT_ID` | `.env` | Twitch app identification |
| `TWITCH_CLIENT_SECRET` | `.env` | Twitch app auth (for getting tokens) |
| `TWITCH_WEBHOOK_SECRET` | `.env` | Verifies incoming Twitch webhooks |
| `STREAMELEMENTS_WEBHOOK_SECRET` | `.env` | Verifies StreamElements webhooks |
| `STREAMLABS_WEBHOOK_SECRET` | `.env` | Verifies Streamlabs webhooks |

**Never commit `.env` to git.** It's already in `.gitignore`.

---

## Default Time Rules

| Event | Time Added |
|-------|-----------|
| Tier 1 Sub | +5 min |
| Tier 2 Sub | +10 min |
| Tier 3 Sub | +20 min |
| Gifted Sub (each) | +5 min |
| 100 Bits | +2 min |
| $1 Donation | +1 min |
| Follow | +1 min (disabled by default) |
| Raid | +5 min (disabled by default) |

All configurable from the admin panel.

---

## Production Deployment

```bash
npm run build
npm start
```

For production, use a process manager like `pm2`:

```bash
npm install -g pm2
pm2 start npm --name marathon-timer -- start
```

The SQLite database is stored in `./data/marathon.db` and persists across restarts. Back it up if needed.

---

## License

MIT
