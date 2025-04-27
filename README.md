# Deal Whisperer

A NestJS application that monitors Salesforce opportunities and alerts the team when deals go cold.

## Features

- Connects to Salesforce using JWT OAuth flow
- Detects cold deals based on activity and modification dates
- Sends notifications to Slack when deals become cold
- Runs automatically every hour

## Prerequisites

- Node.js (v18+)
- PNPM
- Salesforce account
- Slack workspace with permissions to create webhooks

## Installation

```bash
# Install dependencies
pnpm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
SF_CLIENT_ID=your_salesforce_client_id
SF_USERNAME=your_salesforce_username
SF_JWT_KEY_PATH=./cert/server.key
SLACK_WEBHOOK=your_slack_webhook_url
COLD_DAYS=7
STALLED_DAYS=10
```

### Salesforce Connected App Setup with JWT

1. Generate a self-signed certificate for JWT authentication:
   ```bash
   # Create the certificate directory if it doesn't exist
   mkdir -p cert
   
   # Generate a private key
   openssl genrsa -out cert/server.key 2048
   
   # Generate a certificate
   openssl req -new -x509 -key cert/server.key -out cert/server.crt -days 3650
   ```

2. Log in to your Salesforce account
3. Navigate to Setup > App Manager
4. Click "New Connected App"
5. Fill in the required fields:
   - Connected App Name: "Deal Whisperer"
   - API Name: "Deal_Whisperer"
   - Contact Email: your email
6. Check "Enable OAuth Settings"
7. Set the Callback URL to: `http://localhost:3000/callback` (this isn't used but required)
8. Add the OAuth Scopes:
   - "Access and manage your data (api)"
   - "Perform requests on your behalf at any time (refresh_token, offline_access)"
9. Enable "Use digital signatures" and upload the `cert/server.crt` file
10. Save the app
11. After saving, you'll be able to see the Consumer Key (Client ID)
12. Copy this value to your `.env` file as `SF_CLIENT_ID`
13. Keep the `server.key` file secure in the cert directory (it's gitignored)

### Slack Webhook Setup

1. Go to the Slack API website (api.slack.com) and sign in
2. Create a new app (or use an existing one)
3. Navigate to "Incoming Webhooks" in the sidebar
4. Activate incoming webhooks
5. Click "Add New Webhook to Workspace"
6. Choose the channel where you want the notifications to appear
7. Copy the webhook URL provided
8. Add this to your `.env` file as `SLACK_WEBHOOK`

## Usage

```bash
# Development mode
pnpm start:dev

# Production mode
pnpm build
pnpm start:prod
```

## How It Works

1. The application connects to Salesforce using JWT authentication
2. Every hour, it fetches all active opportunities from Salesforce
3. It detects which deals are "cold" based on:
   - No activity for at least COLD_DAYS days (default 7)
   - No modifications for at least STALLED_DAYS days (default 10)
4. For each cold deal, it sends a notification to Slack

## License

MIT
