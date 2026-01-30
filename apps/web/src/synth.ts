import * as Tone from "tone";

export type MusicSpec = {
  bpm: number;
  key: string;
  scale: string;
  chords: string[];
  bassPattern: "root-eighths" | "root-fifths" | "walking";
  drumStyle: "fourOnTheFloor" | "breakbeat" | "boomBap" | "ambient";
  melodyContour: "ascending" | "descending" | "arched" | "randomWalk";
  sound: { lead: "sine" | "triangle" | "saw" | "square"; pad: "sine" | "triangle" | "saw"; bass: "sine" | "triangle" | "saw" | "square" };
};

const NOTE_OFFSETS: Record<string, number> = { C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11 };
const SCALES: Record<string, number[]> = {
  major: [0,2,4,5,7,9,11],
  minor: [0,2,3,5,7,8,10],
  dorian: [0,2,3,5,7,9,10],
  mixolydian: [0,2,4,5,7,9,10],
  phrygian: [0,1,3,5,7,8,10],
};

function degreeToSemis(deg: string): number {
  const map: Record<string, number> = { I:0, ii:2, iii:4, IV:5, V:7, vi:9, "vii°":11 };
  return map[deg] ?? 0;
}

function midiToNote(midi: number): string {
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const name = names[midi % 12];
  const oct = Math.floor(midi / 12) - 1;
  return `${name}${oct}`;
}

/** Map spec waveform names to Tone.js OscillatorNode type. */
function toToneOscType(w: string | undefined): Tone.ToneOscillatorType {
  const t = (w ?? "sine").toLowerCase();
  if (t === "saw") return "sawtooth";
  if (["sine", "triangle", "square", "sawtooth"].includes(t)) return t as Tone.ToneOscillatorType;
  return "sine";
}

function pickSteps(contour: MusicSpec["melodyContour"], length: number): number[] {
  const steps: number[] = [];
  let pos = 0;
  for (let i=0;i<length;i++){
    if (contour === "ascending") pos += (i%3===0?2:1);
    else if (contour === "descending") pos -= (i%3===0?2:1);
    else if (contour === "arched") pos += (i<length/2?1:-1);
    else pos += (Math.random()<0.5?1:-1);
    steps.push(pos);
  }
  return steps;
}

export async function renderClip10s(spec: MusicSpec): Promise<Tone.ToneAudioBuffer> {
  const duration = 10;
  const bpm = Math.min(160, Math.max(60, spec.bpm || 110));
  const secPerBeat = 60 / bpm;
  const secPerBar = 4 * secPerBeat;

  return Tone.Offline(({ transport }) => {
    transport.bpm.value = bpm;

    const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: toToneOscType(spec.sound?.pad ?? "saw") }, envelope: { attack: 0.8, release: 1.5 } }).toDestination();
    const lead = new Tone.Synth({ oscillator: { type: toToneOscType(spec.sound?.lead ?? "triangle") }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.4 } }).toDestination();
    const bass = new Tone.MonoSynth({ oscillator: { type: toToneOscType(spec.sound?.bass ?? "square") }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.2 } }).toDestination();

    const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 8 }).toDestination();
    const snare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).toDestination();
    const hat = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).toDestination();

    const key = spec.key in NOTE_OFFSETS ? spec.key : "C";
    const root = NOTE_OFFSETS[key];
    const scale = SCALES[spec.scale] ?? SCALES.major;
    const chords = (spec.chords?.length ? spec.chords : ["I","vi","IV","V"]).slice(0, 4);

    // Call triggerAttackRelease(time) directly — no transport.schedule, so no "strictly greater" errors
    for (let bar = 0; bar < 4; bar++) {
      const t = bar * secPerBar;
      const semis = degreeToSemis(chords[bar]);
      const chord = [60 + root + semis, 64 + root + semis, 67 + root + semis].map(midiToNote);
      pad.triggerAttackRelease(chord, "1m", t, 0.35);
    }

    for (let bar = 0; bar < 4; bar++) {
      const semis = degreeToSemis(chords[bar]);
      const baseMidi = 36 + root + semis;
      for (let i = 0; i < 8; i++) {
        const t = bar * secPerBar + (i / 8) * secPerBeat;
        const note = (spec.bassPattern === "root-fifths" && i % 2 === 1) ? midiToNote(baseMidi + 7) : midiToNote(baseMidi);
        bass.triggerAttackRelease(note, "8n", t, 0.5);
      }
    }

    const steps = pickSteps(spec.melodyContour, 16);
    for (let i = 0; i < 16; i++) {
      const bar = Math.floor(i / 4);
      const beat = i % 4;
      const t = bar * secPerBar + beat * secPerBeat;
      const deg = ((steps[i] % scale.length) + scale.length) % scale.length;
      const midi = 72 + root + scale[deg];
      lead.triggerAttackRelease(midiToNote(midi), "8n", t, 0.25);
    }

    for (let bar = 0; bar < 4; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        const t = bar * secPerBar + beat * secPerBeat;
        if (spec.drumStyle === "fourOnTheFloor" || spec.drumStyle === "ambient") {
          kick.triggerAttackRelease("C1", "8n", t, 0.9);
        } else if (beat === 0 || beat === 2) {
          kick.triggerAttackRelease("C1", "8n", t, 0.9);
        }
        if (beat === 1 || beat === 3) snare.triggerAttackRelease("16n", t, 0.3);
        for (let sub = 0; sub < 2; sub++) {
          const ht = t + (sub * 2 / 16) * secPerBeat;
          hat.triggerAttackRelease("32n", ht, 0.08);
        }
      }
    }

    transport.start(0);
  }, duration, 2, 44100);
}
