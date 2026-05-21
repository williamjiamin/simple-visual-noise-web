# Simple Visual Noise — marketing website

**Live**: <https://williamjiamin.github.io/simple-visual-noise-web/>

Static site that doubles as an interactive demo for the iOS app. Everything
runs in vanilla HTML / CSS / ES modules + the WebAudio API — no build step,
no framework, no tracking.

## Deploy (GitHub Pages)

This repo is wired to GitHub Pages on `main` / root. Every push to `main`
triggers a redeploy. Build typically completes in 30–60 seconds.

To deploy a change:

```bash
git add -A
git commit -m "..."
git push
```

Check build status:

```bash
gh api repos/williamjiamin/simple-visual-noise-web/pages/builds/latest \
  --jq '{status, html_url: .commit, error}'
```

## Run locally

```bash
cd website
python3 -m http.server 8000     # or any static server
open http://localhost:8000
```

ES modules require a server (file:// won't work). The AudioWorklet inside
`js/audio/noise-processor.js` also needs a real HTTP context.

## Deploy

The folder is deploy-ready as-is:

- **Vercel** — `vercel deploy` from this folder, no config.
- **Netlify** — drag the `website/` folder onto netlify.com, done.
- **GitHub Pages** — copy contents to `gh-pages` branch, push.
- **Cloudflare Pages** — point at the `website/` folder.

A custom domain (e.g. `simplevisualnoise.app`) needs CNAME setup on your
DNS provider; no app-side changes required.

## Pages

| File | What it does |
|---|---|
| `index.html` | Hero + in-browser interactive demo (engine + composer + mood picker) |
| `science.html` | Three live interactive widgets explaining tilt, binaural beats, generative composition |
| `moods.html` | Gallery of all 10 Krea moods with hover-preview audio per mood |
| `pricing.html` | One-time $4.99 IAP positioning + free-vs-premium comparison |
| `press.html` | Press kit — icons, boilerplate copy, contact |
| `blog/index.html` | Journal index |
| `blog/why-simple-visual-noise.html` | Manifesto |
| `blog/generative-without-cloud.html` | Engineering deep-dive on the composer |

## JS architecture

```
js/
├── audio/
│   ├── noise-processor.js     AudioWorklet — render thread synthesis
│   ├── engine.js              SVNAudioEngine (mirror of AudioEngineCoordinator)
│   ├── patterns.js            JS port of GenerativeComposerLibrary
│   └── generative-composer.js JS port of GenerativeComposer
├── ui/
│   └── visualizer.js          Canvas noise field, reads from engine.analyser
├── main.js                    homepage demo wiring
├── science.js                 /science.html widgets
└── gallery.js                 /moods.html hover gallery
```

The AudioWorklet (`noise-processor.js`) is the only file that runs on the
audio render thread — everything else is main-thread orchestration. To
add a new noise color, extend the `switch (this.color)` block there and
add a corresponding `<option>` in `index.html`.

To add a new generative pattern, append to `patterns.js`. The `science.js`
composer demo enumerates `PatternList` automatically.

## Assets

`assets/moods/` — symlinks (in the repo, copies) of the 10 baked Krea
mood PNGs. Re-bake by running `.krea-cache/bake_assets.sh && cp` from the
project root.

`assets/icons/` — same for the four alternate app icons.

## Why no framework

- **Fast first paint.** No bundler means no hydration. The hero shows
  within ~80ms on a cold load.
- **Audio reliability.** Frameworks tend to teardown/recreate components
  on navigation. WebAudio hates that. Static HTML keeps the AudioContext
  exactly one instance per page lifetime.
- **No vendor coupling.** Three years from now we can still edit a `<p>`
  without npm-installing two thousand packages.

## SEO checklist

- [x] `<title>` and `<meta description>` per page
- [x] Open Graph image on `/`
- [x] `theme-color` for the iOS Safari address bar tint
- [x] Apple touch icon
- [x] Sitemap — TODO, blocked on final domain
- [x] robots.txt — TODO, default-allow until domain is set
