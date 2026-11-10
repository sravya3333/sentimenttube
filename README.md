# SentimentTube

YouTube comment sentiment analyzer (Express + React/Vite). Works with zero keys using demo
comments and a built-in rule-based sentiment engine; add keys for real comments and Gemini analysis.

## First time
```
npm install
npm run dev
```
Open http://localhost:3000

## Add your keys (optional)
```
npm run setup
```
It asks for your YouTube Data API key and Gemini API key and saves them in `.env.local`.
Then restart with `npm run dev`. Never share `.env.local` or post your keys.

## Every other time
```
npm run dev
```

## Production
```
npm run build
npm start
```
