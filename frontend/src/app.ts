import { createViz } from "./viz/scene";
import { predictClip } from "./api";
import { startMicStreaming } from "./audio/mic";
import { renderBars } from "./ui/bars";
import { setHud } from "./ui/hud";
import { createEmaSmoother, createStableTop } from "./ui/smoother";

export function mountApp() {
  const canvas = document.querySelector<HTMLCanvasElement>("#viz")!;
  const viz = createViz(canvas);

  const fileInput = document.querySelector<HTMLInputElement>("#file")!;
  const btnMic = document.querySelector<HTMLButtonElement>("#mic")!;
  const bars = document.querySelector<HTMLDivElement>("#bars")!;
  const hud = document.querySelector<HTMLDivElement>("#hud")!;
  const top = document.querySelector<HTMLDivElement>("#top")!;

  // Smoothing + stability (Option A)
  const smoother = createEmaSmoother(0.22);
  const stable = createStableTop({ margin: 0.07, holdFrames: 3 });

  // Gating to avoid “instant jazz” / silence bias
  const MIN_CONFIDENCE = 0.20; // require >= 20% confidence to show a label
  const MIN_ENERGY = 0.02;     // require some audio energy (0..1 scale)
  const MIN_BUFFER_MS = 300;   // ignore predictions for first 300ms after start

  let energy = { bass: 0, mids: 0, highs: 0 };
  let micSession: { stop: () => void } | null = null;
  let micStartTime = 0;

  function resetUi(listeningText = "listening…") {
    top.textContent = "Top: —";
    bars.innerHTML = "";
    setHud(hud, listeningText);
  }

  function loop() {
    viz.render(energy);
    requestAnimationFrame(loop);
  }
  loop();

  // File upload (offline/clip inference)
  fileInput.onchange = async () => {
    const f = fileInput.files?.[0];
    if (!f) return;

    setHud(hud, "Running clip inference…");
    const t0 = performance.now();
    const out = await predictClip(f);
    const dt = performance.now() - t0;

    top.textContent = `Top: ${out.top}`;
    renderBars(bars, out.probs);
    setHud(hud, `clip latency: ${Math.round(out.latency_ms ?? dt)}ms`);
  };

  // Mic streaming (real-time inference)
  btnMic.onclick = async () => {
    // STOP
    if (micSession) {
      smoother.reset();
      stable.reset();
      micSession.stop();
      micSession = null;

      btnMic.textContent = "Start Mic";
      top.textContent = "Top: —";
      bars.innerHTML = "";
      setHud(hud, "mic stopped");
      return;
    }

    // START: reset backend + frontend state + UI
    try {
      await fetch("http://localhost:8000/reset_stream", { method: "POST" });
    } catch (e) {
      console.warn("reset_stream failed", e);
    }

    smoother.reset();
    stable.reset();
    resetUi("listening…");

    btnMic.textContent = "Stop Mic";
    micStartTime = performance.now();

    micSession = await startMicStreaming({
      onEnergy: (bass, mids, highs) => {
        energy = { bass, mids, highs };
      },

      onPrediction: (payload) => {
        // Backend still buffering mel frames (incremental cache)
        if (!payload?.ready) {
          const need = payload.needed_frames ?? "?";
          setHud(hud, `buffering… (${need} frames needed)`);
          return;
        }

        // Avoid reacting immediately at start (gives buffer time to fill with real audio)
        const elapsed = performance.now() - micStartTime;
        if (elapsed < MIN_BUFFER_MS) {
          setHud(hud, "buffering… (warming up)");
          return;
        }

        // Compute instantaneous audio energy (from analyser bands)
        const avgEnergy = (energy.bass + energy.mids + energy.highs) / 3;

        // Smooth probabilities
        const smoothed = smoother.update(payload.probs);

        // Stable top selection
        const stableTop = stable.update(smoothed);
        const topProb = smoothed[stableTop] ?? 0;

        // Gate: don’t show a label if it's basically silence or low confidence
        if (avgEnergy < MIN_ENERGY || topProb < MIN_CONFIDENCE) {
          top.textContent = "Top: —";
          // Optional: keep bars moving so it feels responsive
          renderBars(bars, smoothed);
          setHud(
            hud,
            `listening… (energy ${avgEnergy.toFixed(3)}, conf ${Math.round(topProb * 100)}%)`
          );
          return;
        }

        // Show accepted prediction
        const conf = Math.round(topProb * 100);
        top.textContent = `Top: ${stableTop} (${conf}%)`;
        renderBars(bars, smoothed);

        const ms = Math.round(payload.latency_ms ?? 0);
        setHud(hud, `predicting • ${ms}ms`);
      },
    });
  };
}

