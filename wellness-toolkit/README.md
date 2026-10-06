# Wellness Toolkit

A single-page React app with six tools: guided breathing (power and rapid), a cold shower timer, a HIIT interval timer with animated stick-figure exercises, a weights tracker, and a guided 30 minute yoga session (5 minute warm-up, 20 minutes of shuffled poses, 5 minute relaxation) with animated stick figures, and a three-question daily journal. Voice guidance and ocean waves use the browser's built-in speech and Web Audio. Settings and logs are saved in `localStorage` (per browser, per device).

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

## The `dist/` folder

`dist/index.html` is a ready-to-host standalone version (React and Babel load from a CDN). Upload it to any static host, such as Netlify Drop or Cloudflare Pages. Running `npm run build` replaces it with an optimised Vite bundle.

## Embedding in Squarespace

Host `dist/` somewhere, then add a Code block (HTML mode, Display Source off):

```html
<iframe src="https://YOUR-HOST/index.html" style="width:100%;height:900px;border:0"></iframe>
```

## Structure

```
src/
  App.jsx               tab shell
  components/           Breathing, Cold, Hiit, Stick, Weights, Yoga, Journal
  data/                 exercises, stick-figure animations, weight splits, yoga poses
  lib/                  audio (waves + speech), storage helpers
  styles.css
```
