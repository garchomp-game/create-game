import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../public/audio");
const TAU = Math.PI * 2;

function createBuffer(duration) {
  const length = Math.ceil(duration * SAMPLE_RATE);
  return {
    left: new Float64Array(length),
    right: new Float64Array(length),
  };
}

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function envelope(time, duration, attack = 0.005, release = 0.05) {
  if (time < 0 || time >= duration) return 0;
  const attackGain = attack <= 0 ? 1 : smoothstep(time / attack);
  const releaseGain = release <= 0 ? 1 : smoothstep((duration - time) / release);
  return Math.min(attackGain, releaseGain);
}

function oscillator(type, phase) {
  const wrapped = phase - Math.floor(phase);
  if (type === "saw") return wrapped * 2 - 1;
  if (type === "square") return wrapped < 0.5 ? 1 : -1;
  if (type === "triangle") return 1 - 4 * Math.abs(wrapped - 0.5);
  return Math.sin(TAU * wrapped);
}

function panGains(pan = 0) {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function addSample(buffer, index, value, pan = 0) {
  if (index < 0 || index >= buffer.left.length) return;
  const [leftGain, rightGain] = panGains(pan);
  buffer.left[index] += value * leftGain;
  buffer.right[index] += value * rightGain;
}

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function addTone(
  buffer,
  {
    start,
    duration,
    frequency,
    endFrequency = frequency,
    gain = 0.2,
    wave = "sine",
    attack = 0.005,
    release = 0.05,
    pan = 0,
    harmonics = [],
  },
) {
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  let phase = 0;
  for (let offset = 0; offset < sampleCount; offset += 1) {
    const localTime = offset / SAMPLE_RATE;
    const progress = localTime / duration;
    const frequencyAtTime = frequency * (endFrequency / frequency) ** progress;
    phase += frequencyAtTime / SAMPLE_RATE;
    let value = oscillator(wave, phase);
    for (const harmonic of harmonics) {
      value +=
        oscillator(harmonic.wave ?? "sine", phase * harmonic.multiple) * harmonic.gain;
    }
    addSample(
      buffer,
      startIndex + offset,
      value * gain * envelope(localTime, duration, attack, release),
      pan,
    );
  }
}

function addBell(buffer, { start, notes, gain = 0.2, pan = 0, spacing = 0.07 }) {
  notes.forEach((note, index) => {
    const frequency = midiToFrequency(note);
    addTone(buffer, {
      start: start + index * spacing,
      duration: 0.22,
      frequency,
      gain,
      wave: "sine",
      attack: 0.002,
      release: 0.18,
      pan: pan + (index % 2 === 0 ? -0.08 : 0.08),
      harmonics: [
        { multiple: 2.01, gain: 0.32 },
        { multiple: 3.98, gain: 0.14 },
      ],
    });
  });
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function addNoise(
  buffer,
  {
    start,
    duration,
    gain = 0.2,
    attack = 0.001,
    release = duration,
    pan = 0,
    seed = 1,
    color = "white",
  },
) {
  const random = seededRandom(seed);
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  let low = 0;
  let previousLow = 0;
  for (let offset = 0; offset < sampleCount; offset += 1) {
    const localTime = offset / SAMPLE_RATE;
    const white = random() * 2 - 1;
    low += (white - low) * 0.08;
    let value = white;
    if (color === "low") value = low;
    if (color === "high") value = white - low + (low - previousLow) * 0.5;
    previousLow = low;
    addSample(
      buffer,
      startIndex + offset,
      value * gain * envelope(localTime, duration, attack, release),
      pan,
    );
  }
}

function addCircularDelay(buffer, delaySeconds, gain, cross = false) {
  const sourceLeft = buffer.left.slice();
  const sourceRight = buffer.right.slice();
  const delay = Math.round(delaySeconds * SAMPLE_RATE);
  const length = buffer.left.length;
  for (let index = 0; index < length; index += 1) {
    const target = (index + delay) % length;
    buffer.left[target] += (cross ? sourceRight[index] : sourceLeft[index]) * gain;
    buffer.right[target] += (cross ? sourceLeft[index] : sourceRight[index]) * gain;
  }
}

function addDelay(buffer, delaySeconds, gain, cross = false) {
  const sourceLeft = buffer.left.slice();
  const sourceRight = buffer.right.slice();
  const delay = Math.round(delaySeconds * SAMPLE_RATE);
  for (let index = 0; index + delay < buffer.left.length; index += 1) {
    const target = index + delay;
    buffer.left[target] += (cross ? sourceRight[index] : sourceLeft[index]) * gain;
    buffer.right[target] += (cross ? sourceLeft[index] : sourceRight[index]) * gain;
  }
}

function mix(target, source, gain = 1) {
  for (let index = 0; index < target.left.length; index += 1) {
    target.left[index] += source.left[index] * gain;
    target.right[index] += source.right[index] * gain;
  }
}

function finalize(buffer, targetPeak = 0.82, fadeSeconds = 0.004) {
  let peak = 0;
  for (let index = 0; index < buffer.left.length; index += 1) {
    buffer.left[index] = Math.tanh(buffer.left[index] * 1.08);
    buffer.right[index] = Math.tanh(buffer.right[index] * 1.08);
    peak = Math.max(peak, Math.abs(buffer.left[index]), Math.abs(buffer.right[index]));
  }
  const scale = peak === 0 ? 1 : targetPeak / peak;
  const fadeSamples = Math.min(Math.floor(fadeSeconds * SAMPLE_RATE), buffer.left.length / 2);
  for (let index = 0; index < buffer.left.length; index += 1) {
    let fade = 1;
    if (fadeSamples > 0 && index < fadeSamples) fade = smoothstep(index / fadeSamples);
    if (fadeSamples > 0 && index >= buffer.left.length - fadeSamples) {
      fade = smoothstep((buffer.left.length - 1 - index) / fadeSamples);
    }
    buffer.left[index] *= scale * fade;
    buffer.right[index] *= scale * fade;
  }
  return buffer;
}

function writeWav(path, buffer) {
  const bytesPerFrame = 4;
  const dataSize = buffer.left.length * bytesPerFrame;
  const output = Buffer.alloc(44 + dataSize);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataSize, 4);
  output.write("WAVE", 8);
  output.write("fmt ", 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(2, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * bytesPerFrame, 28);
  output.writeUInt16LE(bytesPerFrame, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < buffer.left.length; index += 1) {
    const offset = 44 + index * bytesPerFrame;
    output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buffer.left[index])) * 32_767), offset);
    output.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, buffer.right[index])) * 32_767),
      offset + 2,
    );
  }
  writeFileSync(path, output);
}

function encodeOgg(name, buffer, quality = 5) {
  const wavPath = resolve(OUTPUT_DIR, `.${name}.wav`);
  const oggPath = resolve(OUTPUT_DIR, `${name}.ogg`);
  writeWav(wavPath, buffer);
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      wavPath,
      "-c:a",
      "libvorbis",
      "-q:a",
      String(quality),
      oggPath,
    ],
    { encoding: "utf8" },
  );
  rmSync(wavPath, { force: true });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${name}: ${result.stderr}`);
  }
}

function makeShot(variant) {
  const buffer = createBuffer(0.145);
  const shift = [0, 70, -55][variant];
  addNoise(buffer, {
    start: 0,
    duration: 0.035,
    gain: 0.5,
    release: 0.03,
    seed: 110 + variant,
    color: "high",
  });
  addTone(buffer, {
    start: 0,
    duration: 0.13,
    frequency: 960 + shift,
    endFrequency: 190 + shift * 0.25,
    gain: 0.58,
    wave: variant === 1 ? "saw" : "triangle",
    attack: 0.001,
    release: 0.085,
    pan: [-0.06, 0.06, 0][variant],
    harmonics: [{ multiple: 2, gain: 0.18 }],
  });
  addTone(buffer, {
    start: 0.012,
    duration: 0.09,
    frequency: 135,
    endFrequency: 68,
    gain: 0.28,
    wave: "sine",
    release: 0.07,
  });
  return finalize(buffer, 0.78);
}

function makeHit(variant) {
  const buffer = createBuffer(0.13);
  addNoise(buffer, {
    start: 0,
    duration: 0.075,
    gain: 0.72,
    release: 0.06,
    seed: 220 + variant,
    color: variant === 2 ? "high" : "low",
    pan: [-0.08, 0.08, 0][variant],
  });
  addTone(buffer, {
    start: 0,
    duration: 0.115,
    frequency: 155 + variant * 18,
    endFrequency: 72,
    gain: 0.54,
    wave: "triangle",
    release: 0.09,
  });
  return finalize(buffer, 0.68);
}

function makeKill(variant) {
  const buffer = createBuffer(0.31);
  addNoise(buffer, {
    start: 0,
    duration: 0.11,
    gain: 0.62,
    release: 0.09,
    seed: 330 + variant,
    color: "high",
  });
  addTone(buffer, {
    start: 0,
    duration: 0.2,
    frequency: variant === 0 ? 210 : 245,
    endFrequency: 72,
    gain: 0.55,
    wave: "saw",
    release: 0.15,
  });
  addBell(buffer, {
    start: 0.075,
    notes: variant === 0 ? [74, 81] : [77, 84],
    gain: 0.2,
    pan: variant === 0 ? -0.12 : 0.12,
    spacing: 0.055,
  });
  return finalize(buffer, 0.72);
}

function makePickup(variant) {
  const buffer = createBuffer(0.27);
  addBell(buffer, {
    start: 0,
    notes: variant === 0 ? [79, 86] : [81, 88],
    gain: 0.36,
    pan: variant === 0 ? -0.1 : 0.1,
    spacing: 0.065,
  });
  return finalize(buffer, 0.72, 0.003);
}

function makeLevelUp() {
  const buffer = createBuffer(0.78);
  addBell(buffer, { start: 0, notes: [74, 77, 81, 86], gain: 0.3, spacing: 0.12 });
  addTone(buffer, {
    start: 0.34,
    duration: 0.38,
    frequency: midiToFrequency(74),
    endFrequency: midiToFrequency(86),
    gain: 0.16,
    wave: "triangle",
    attack: 0.04,
    release: 0.24,
  });
  addDelay(buffer, 0.08, 0.12, true);
  return finalize(buffer, 0.78, 0.006);
}

function makeUpgrade() {
  const buffer = createBuffer(0.72);
  addNoise(buffer, {
    start: 0,
    duration: 0.42,
    gain: 0.14,
    attack: 0.12,
    release: 0.2,
    seed: 440,
    color: "high",
  });
  addTone(buffer, {
    start: 0,
    duration: 0.42,
    frequency: 180,
    endFrequency: 880,
    gain: 0.23,
    wave: "saw",
    attack: 0.08,
    release: 0.18,
  });
  for (const [index, note] of [62, 69, 74].entries()) {
    addTone(buffer, {
      start: 0.28,
      duration: 0.38,
      frequency: midiToFrequency(note),
      gain: 0.22 - index * 0.025,
      wave: "triangle",
      attack: 0.025,
      release: 0.28,
      pan: (index - 1) * 0.18,
      harmonics: [{ multiple: 2, gain: 0.16 }],
    });
  }
  return finalize(buffer, 0.8, 0.006);
}

function makeDamage(variant) {
  const buffer = createBuffer(0.31);
  addNoise(buffer, {
    start: 0,
    duration: 0.17,
    gain: 0.8,
    release: 0.13,
    seed: 550 + variant,
    color: variant === 0 ? "low" : "white",
    pan: variant === 0 ? -0.08 : 0.08,
  });
  addTone(buffer, {
    start: 0,
    duration: 0.28,
    frequency: variant === 0 ? 118 : 132,
    endFrequency: 42,
    gain: 0.72,
    wave: "square",
    attack: 0.001,
    release: 0.22,
  });
  return finalize(buffer, 0.72);
}

function makeGameOver() {
  const buffer = createBuffer(1.42);
  const notes = [69, 64, 60, 57];
  notes.forEach((note, index) => {
    addTone(buffer, {
      start: index * 0.22,
      duration: 0.5,
      frequency: midiToFrequency(note),
      gain: 0.29,
      wave: "triangle",
      attack: 0.015,
      release: 0.32,
      pan: index % 2 === 0 ? -0.12 : 0.12,
      harmonics: [{ multiple: 0.5, gain: 0.22 }],
    });
  });
  addTone(buffer, {
    start: 0.64,
    duration: 0.72,
    frequency: midiToFrequency(45),
    endFrequency: midiToFrequency(33),
    gain: 0.26,
    wave: "sine",
    attack: 0.04,
    release: 0.5,
  });
  addDelay(buffer, 0.12, 0.13, true);
  return finalize(buffer, 0.8, 0.008);
}

function makeExpeditionClearLoop() {
  const duration = 12.8;
  const beat = 0.4;
  const bar = beat * 4;
  const buffer = createBuffer(duration);
  const melodic = createBuffer(duration);
  const progression = [
    { root: 48, chord: [60, 64, 67, 72] },
    { root: 53, chord: [65, 69, 72, 77] },
    { root: 55, chord: [67, 71, 74, 79] },
    { root: 57, chord: [69, 72, 76, 81] },
  ];
  const melody = [72, 76, 79, 84, 81, 79, 76, 79];

  for (let barIndex = 0; barIndex < 8; barIndex += 1) {
    const chord = progression[barIndex % progression.length];
    const start = barIndex * bar;
    for (const [index, note] of chord.chord.slice(0, 3).entries()) {
      addTone(buffer, {
        start,
        duration: bar * 0.96,
        frequency: midiToFrequency(note),
        gain: 0.065,
        wave: "triangle",
        attack: 0.035,
        release: 0.18,
        pan: (index - 1) * 0.34,
        harmonics: [{ multiple: 2, gain: 0.14 }],
      });
    }
    for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
      const beatStart = start + beatIndex * beat;
      addTone(buffer, {
        start: beatStart,
        duration: beat * 0.7,
        frequency: midiToFrequency(chord.root + (beatIndex === 3 ? 7 : 0)),
        gain: 0.18,
        wave: "triangle",
        attack: 0.006,
        release: 0.12,
      });
      addKick(buffer, beatStart, beatIndex === 0 ? 0.32 : 0.24);
      if (beatIndex === 1 || beatIndex === 3) addSnare(buffer, beatStart, 0.17);
    }
    for (let eighth = 0; eighth < 8; eighth += 1) {
      const note = melody[(eighth + barIndex * 2) % melody.length];
      addTone(melodic, {
        start: start + eighth * (beat / 2),
        duration: beat * 0.38,
        frequency: midiToFrequency(note),
        gain: 0.1,
        wave: "triangle",
        attack: 0.008,
        release: 0.1,
        pan: eighth % 2 === 0 ? -0.22 : 0.22,
        harmonics: [{ multiple: 2.01, gain: 0.18 }],
      });
    }
  }

  addCircularDelay(melodic, 0.2, 0.16, true);
  addCircularDelay(melodic, 0.4, 0.08, false);
  mix(buffer, melodic);
  return finalize(buffer, 0.74, 0.01);
}

function addKick(buffer, start, gain = 0.34) {
  addTone(buffer, {
    start,
    duration: 0.18,
    frequency: 118,
    endFrequency: 42,
    gain,
    wave: "sine",
    attack: 0.001,
    release: 0.14,
  });
  addNoise(buffer, {
    start,
    duration: 0.018,
    gain: gain * 0.42,
    release: 0.016,
    seed: 700 + Math.floor(start * 10),
    color: "high",
  });
}

function addSnare(buffer, start, gain = 0.2) {
  addNoise(buffer, {
    start,
    duration: 0.14,
    gain,
    release: 0.12,
    seed: 810 + Math.floor(start * 10),
    color: "high",
  });
  addTone(buffer, {
    start,
    duration: 0.11,
    frequency: 195,
    endFrequency: 128,
    gain: gain * 0.55,
    wave: "triangle",
    release: 0.09,
  });
}

function makeArenaLoop() {
  const duration = 32;
  const beat = 0.5;
  const bar = beat * 4;
  const buffer = createBuffer(duration);
  const melodic = createBuffer(duration);
  const progression = [
    { root: 38, chord: [50, 53, 57, 62] },
    { root: 34, chord: [46, 50, 53, 58] },
    { root: 41, chord: [53, 57, 60, 65] },
    { root: 36, chord: [48, 52, 55, 60] },
  ];
  const arpPattern = [0, 1, 2, 1, 3, 2, 1, 2];

  for (let barIndex = 0; barIndex < 16; barIndex += 1) {
    const section = Math.floor(barIndex / 4);
    const chord = progression[barIndex % progression.length];
    const start = barIndex * bar;
    const intensity = [0.72, 0.9, 1, 0.86][section];

    for (const [index, note] of chord.chord.slice(0, 3).entries()) {
      addTone(buffer, {
        start,
        duration: bar * 0.98,
        frequency: midiToFrequency(note),
        gain: 0.045 * intensity,
        wave: "triangle",
        attack: 0.12,
        release: 0.24,
        pan: (index - 1) * 0.38,
        harmonics: [{ multiple: 0.5, gain: 0.2 }],
      });
    }

    for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
      const beatStart = start + beatIndex * beat;
      const bassNote = beatIndex === 3 && barIndex % 4 === 3 ? chord.root + 7 : chord.root;
      addTone(buffer, {
        start: beatStart,
        duration: beat * 0.78,
        frequency: midiToFrequency(bassNote),
        gain: 0.19 * intensity,
        wave: "triangle",
        attack: 0.008,
        release: 0.16,
        harmonics: [{ multiple: 2, gain: 0.16 }],
      });
      addKick(buffer, beatStart, (beatIndex === 0 ? 0.34 : 0.27) * intensity);
      if (beatIndex === 1 || beatIndex === 3) addSnare(buffer, beatStart, 0.19 * intensity);
    }

    for (let eighth = 0; eighth < 8; eighth += 1) {
      const note = chord.chord[arpPattern[(eighth + section) % arpPattern.length]] + 12;
      addTone(melodic, {
        start: start + eighth * (beat / 2),
        duration: beat * 0.42,
        frequency: midiToFrequency(note),
        gain: 0.09 * intensity,
        wave: "triangle",
        attack: 0.006,
        release: 0.11,
        pan: eighth % 2 === 0 ? -0.28 : 0.28,
        harmonics: [{ multiple: 2, gain: section === 2 ? 0.22 : 0.12 }],
      });
      if (section > 0 || eighth % 2 === 0) {
        addNoise(buffer, {
          start: start + eighth * (beat / 2),
          duration: 0.05,
          gain: [0.024, 0.031, 0.038, 0.029][section] * intensity,
          release: 0.042,
          seed: 920 + barIndex * 8 + eighth,
          color: "high",
          pan: eighth % 2 === 0 ? -0.18 : 0.18,
        });
      }
    }

    if (section === 1 || section === 3) {
      const motifs = [
        [74, 77, 81, 77],
        [70, 74, 77, 74],
        [77, 81, 84, 81],
        [72, 76, 79, 76],
      ];
      motifs[barIndex % 4].forEach((note, index) => {
        addTone(melodic, {
          start: start + index * beat,
          duration: beat * 0.72,
          frequency: midiToFrequency(note),
          gain: section === 3 ? 0.095 : 0.08,
          wave: "sine",
          attack: 0.025,
          release: 0.2,
          pan: index % 2 === 0 ? -0.16 : 0.16,
          harmonics: [{ multiple: 2.01, gain: 0.2 }],
        });
      });
    }
  }

  addCircularDelay(melodic, 0.25, 0.18, true);
  addCircularDelay(melodic, 0.5, 0.09, false);
  mix(buffer, melodic);
  return finalize(buffer, 0.72, 0.012);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const assets = [
  ["shot", makeShot(0)],
  ["shot-alt-1", makeShot(1)],
  ["shot-alt-2", makeShot(2)],
  ["hit", makeHit(0)],
  ["hit-alt-1", makeHit(1)],
  ["hit-alt-2", makeHit(2)],
  ["kill", makeKill(0)],
  ["kill-alt-1", makeKill(1)],
  ["pickup", makePickup(0)],
  ["pickup-alt-1", makePickup(1)],
  ["level-up", makeLevelUp()],
  ["upgrade", makeUpgrade()],
  ["damage", makeDamage(0)],
  ["damage-alt-1", makeDamage(1)],
  ["game-over", makeGameOver()],
  ["arena-loop", makeArenaLoop()],
  ["expedition-clear-loop", makeExpeditionClearLoop()],
];

for (const [name, buffer] of assets) {
  encodeOgg(name, buffer, name.endsWith("-loop") ? 6 : 5);
  process.stdout.write(`generated public/audio/${name}.ogg\n`);
}
