
# Deploying to Render

## Steps to deploy your bot on Render:

1. **Connect your GitHub repository to Render**
   - Go to https://render.com
   - Sign up/login and connect your GitHub account
   - Click "New" → "Web Service"
   - Connect your repository

2. **Configure the service:**
   - **Name**: Your bot name
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`

3. **Environment Variables:**
   Add these in Render dashboard:
   - All your config variables from `config.json`
   - `PORT`: 10000 (Render's default)

4. **Auto-Deploy:**
   - Enable auto-deploy from main branch
   - Render will restart automatically on crashes

## Important Notes:
- Your uptime monitor will now send alerts to bot owners when system usage hits 95%
- The `/ping` endpoint helps with external monitoring services
- Render provides automatic SSL and custom domains

## Monitoring:
- Use the uptime monitor at your-app.onrender.com
- Set up external monitoring with UptimeRobot pointing to your `/ping` endpoint
- System alerts will be sent via Facebook Messenger to configured admin IDs
