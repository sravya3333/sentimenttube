# SentimentTube

YouTube comment sentiment analyzer. Paste a YouTube link, and the app fetches the latest comments and uses Gemini AI to classify each one as positive, neutral, or negative, with a short reason and a sentiment chart.

**Live demo:** https://sentimenttube.onrender.com

Note: Hosted on Render's free plan, so the first load after inactivity can take up to a minute.

## Tech stack

- React 19 + Vite (frontend)
- Node.js + Express + TypeScript (backend)
- Google Gemini API (sentiment analysis)
- YouTube Data API v3 (comments)

## Run locally

    npm install
    npm run dev

Open http://localhost:3000

## Add your keys

Create a file named .env.local in the project root with these two lines:

    YOUTUBE_API_KEY="your_youtube_key"
    GEMINI_API_KEY="your_gemini_key"

Never share .env.local or post your keys.

## Deploy

Deployed on Render as a Node web service. Set GEMINI_API_KEY, YOUTUBE_API_KEY, and NODE_ENV=production in the Environment settings.
