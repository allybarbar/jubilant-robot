# Wellness Toolkit

A single-page React app with wellness timers and trackers, a daily journal, body stats, and AI insights. Voice guidance and ocean waves use the browser's built-in speech and Web Audio. Settings and logs are saved in `localStorage` (per browser, per device).

AI insights run entirely in the browser using a quantized open model. The first summary downloads model files from Hugging Face (several hundred MB); the browser can cache them for later use. No user logs are sent to a server. Journal answers and body measurements are excluded unless the user opts in.

Breath-hold practice is not safe in or near water, while driving or standing. Check with a doctor first if you have a heart condition, epilepsy, high blood pressure or are pregnant.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (branch `main`).
2. In the repository go to Settings > Pages and set Source to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every push.

## Static hosting

Run `npm run build` before uploading `dist/` to a static host, such as Netlify Drop or Cloudflare Pages. The generated app includes the browser AI runtime and WebAssembly engine; the language model itself downloads from Hugging Face when the user first generates a summary.

## Embedding in Squarespace

Host `dist/` somewhere, then add a Code block (HTML mode, Display Source off):

```html
<iframe src="https://YOUR-HOST/index.html" style="width:100%;height:900px;border:0"></iframe>
```

## Structure

```
src/
  App.jsx               tab shell
  components/           Breathing, Cold, Hiit, Stick, Weights, Yoga, Journal, BodyStats, Insights
  data/                 exercises, stick-figure animations, weight splits, yoga poses
  lib/                  audio (waves + speech), storage helpers
  styles.css
```
