import React, { useMemo, useState } from "react";
import * as Tone from "tone";
import { renderClip10s, type MusicSpec } from "./synth";
import { audioBufferToWavBlob } from "./wav";

const API_BASE = "http://localhost:3001";

type ApiResponse = {
  creativeBrief: string;
  musicSpec: MusicSpec;
};

export default function App() {
  const [prompt, setPrompt] = useState("A short futuristic intro for a cloud architecture demo.");
  const [mood, setMood] = useState("confident, uplifting");
  const [style, setStyle] = useState("synthwave, clean mix, modern");
  const [instruments, setInstruments] = useState("synth lead, warm pad, punchy kick, crisp hats");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [brief, setBrief] = useState("");
  const [spec, setSpec] = useState<MusicSpec | null>(null);

  const [audioUrl, setAudioUrl] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");

  const requestBody = useMemo(() => ({ prompt, mood, style, instruments }), [prompt, mood, style, instruments]);

  async function generate() {
    setBusy(true);
    setErr("");
    setBrief("");
    setSpec(null);
    setAudioUrl("");
    setDownloadUrl("");

    try {
      const r = await fetch(`${API_BASE}/api/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);

      const resp = data as ApiResponse;
      setBrief(resp.creativeBrief);
      setSpec(resp.musicSpec);

      const toneBuffer = await renderClip10s(resp.musicSpec);
      const audioBuffer = toneBuffer.get() as AudioBuffer;

      const blob = audioBufferToWavBlob(audioBuffer);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setDownloadUrl(url);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function unlockAudio() {
    try { await Tone.start(); } catch {}
  }

  return (
    <div className="page" onClick={unlockAudio}>
      <header className="header">
        <div>
          <h1>Music Loop Prompt</h1>
          <p className="sub">LangChain.js + Ollama → Music Spec → Tone.js synth → 10s WAV download</p>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Prompt</h2>

          <label className="label">
            Prompt
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} />
          </label>

          <label className="label">
            Mood
            <input value={mood} onChange={e => setMood(e.target.value)} />
          </label>

          <label className="label">
            Style
            <input value={style} onChange={e => setStyle(e.target.value)} />
          </label>

          <label className="label">
            Instruments
            <input value={instruments} onChange={e => setInstruments(e.target.value)} />
          </label>

          <button className="btn" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate 10s clip"}
          </button>

          {err ? <div className="error"><strong>Error:</strong> {err}</div> : null}
        </section>

        <section className="card">
          <h2>Output</h2>

          {brief ? (
            <>
              <h3>Creative brief</h3>
              <pre className="pre">{brief}</pre>
            </>
          ) : (
            <p className="muted">Run a prompt to see the creative brief.</p>
          )}

          {spec ? (
            <>
              <h3>Music spec</h3>
              <pre className="pre">{JSON.stringify(spec, null, 2)}</pre>
            </>
          ) : null}

          {audioUrl ? (
            <>
              <h3>Preview</h3>
              <audio controls src={audioUrl} />
              <div className="download">
                <a className="link" href={downloadUrl} download="music-loop-prompt.wav">
                  Download WAV
                </a>
              </div>
            </>
          ) : (
            <p className="muted">Audio preview appears after rendering.</p>
          )}
        </section>
      </main>

    </div>
  );
}
