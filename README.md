# Music Loop Prompt — Ollama + LangChain.js + Tone.js 🎵🤖
A **local** music-idea → spec → 10s clip app. Runs on your machine with **no API keys** (Mac, Linux, or Windows with Node + Ollama).

*(Optional: add a screenshot at `docs/screenshot.png` and uncomment the line below.)*
<!-- ![Music Loop Prompt](docs/screenshot.png) -->

**What it does**
- A React web page collects a music idea: *prompt, mood, style, instruments*
- **Agent (LangChain.js + Ollama)** turns that into:
  1) a short **Creative Brief** (human-readable)
  2) a **Music Spec JSON** (tempo, key, chords, patterns)
- The browser uses **Tone.js** to **synthesize a 10-second clip**, previews it, and lets you **download WAV**

> Local composition + synthesis (not diffusion). No Python — Node.js only.

---

## Quick start
```bash
git clone https://github.com/nick-everus/music-loop-prompt.git
cd music-loop-prompt
npm install
npm run dev
```
Then open http://localhost:5173 (and ensure [Ollama](https://ollama.com) is running with a model, e.g. `ollama pull llama3`).

---

## Prereqs
### 1) Install Ollama
Install Ollama for macOS and ensure it runs locally.  
Ollama API docs: https://docs.ollama.com/api/introduction

Pull a model (example):
```bash
ollama pull llama3
# or another model you like
```

Ollama runs at `http://localhost:11434` by default.

### 2) Node.js
Node 18+ recommended.

---

## Run the project

### 1) Install dependencies
From repo root:
```bash
npm install
```

### 2) Start API + Web
```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

---

## How it works

### Agent: LangChain.js + Ollama
The API uses **@langchain/ollama** (`ChatOllama`) to call your local Ollama and return a music spec. No API keys required.

### Audio synthesis: Tone.js Offline rendering
The UI renders audio using **Tone.Offline**, which uses an OfflineAudioContext to render faster than real-time and returns a buffer:
https://tonejs.github.io/docs/15.0.4/functions/Offline.html

We then encode the rendered PCM buffer as **WAV** and create a downloadable link.

---

## Troubleshooting

### “Ollama connection refused”
Start Ollama / load your model:
```bash
ollama run llama3
```

### “My clip is silent”
Try:
- change instruments in the prompt
- use a simpler style (e.g. “lofi”, “synthwave”)
- ensure your browser allows audio playback (click the page once)

### Change the model
Set `OLLAMA_MODEL` (default is `llama3`):
```bash
export OLLAMA_MODEL=llama3
npm run dev
```

---

## Configuration (optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `llama3` | Model name to use |
| `PORT` | `3001` | API server port |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for the web app |

---

## Project structure
- `apps/api` — Express + TS. LangChain.js agent calls Ollama and returns the spec.
- `apps/web` — React + TS + Tone.js. Renders 10s audio, previews, downloads.

---

## License
MIT
