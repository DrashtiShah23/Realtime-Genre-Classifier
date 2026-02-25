import { predictChunk } from "../api";

function encodeWavMonoFloat32(samples: Float32Array, sampleRate: number): Blob {
  // 16-bit PCM WAV
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function startMicStreaming(opts: {
  onEnergy: (bass: number, mids: number, highs: number) => void;
  onPrediction: (payload: any) => void;
}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);

  // ScriptProcessor is deprecated but widely supported; AudioWorklet is nicer later.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  src.connect(proc);
  proc.connect(ctx.destination);

  const fft = new Uint8Array(analyser.frequencyBinCount);

  let chunk: number[] = [];
  const targetMs = 300; // send every ~300ms
  const targetSamples = Math.floor((ctx.sampleRate * targetMs) / 1000);

  proc.onaudioprocess = async (e) => {
    const input = e.inputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) chunk.push(input[i]);

    analyser.getByteFrequencyData(fft);
    const n = fft.length;
    const bass = avg(fft, 0, Math.floor(n * 0.12));
    const mids = avg(fft, Math.floor(n * 0.12), Math.floor(n * 0.45));
    const highs = avg(fft, Math.floor(n * 0.45), n);
    opts.onEnergy(bass / 255, mids / 255, highs / 255);

    if (chunk.length >= targetSamples) {
      const samples = new Float32Array(chunk.splice(0, chunk.length));
      const wav = encodeWavMonoFloat32(samples, ctx.sampleRate);

      console.log("[mic] sending chunk", samples.length);

      try {
        const payload = await predictChunk(wav);
        opts.onPrediction(payload);
      } catch (err){
        // ignore transient errors
        console.log("[mic] predict error", err);
      }
    }
  };

  function stop() {
    proc.disconnect();
    analyser.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  }

  return { stop };
}

function avg(arr: Uint8Array, a: number, b: number) {
  let s = 0;
  const end = Math.max(a + 1, b);
  for (let i = a; i < end; i++) s += arr[i];
  return s / (end - a);
}
