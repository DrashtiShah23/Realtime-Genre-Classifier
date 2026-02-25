from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import time

from .model import GenreModel
from .audio_features import decode_audio, waveform_to_mel_window, SR, HOP, FRAMES
from .stream_state import StreamBuffer

GENRES = ["blues","classical","country","disco","hiphop","jazz","metal","pop","reggae","rock"]

# Streaming window in samples must match training frames:
WIN_SAMPLES = FRAMES * HOP

app = FastAPI(title="Real-Time Genre Classifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

model = GenreModel("training/artifacts/saved_model")

# one global buffer for demo; in production use per-client session ids
stream_buf = StreamBuffer(sr=SR, win_samples=WIN_SAMPLES, max_samples=WIN_SAMPLES * 3)

def to_response(probs: np.ndarray, latency_ms: float):
    top_idx = int(np.argmax(probs))
    return {
        "top": GENRES[top_idx],
        "latency_ms": float(latency_ms),
        "probs": {GENRES[i]: float(probs[i]) for i in range(len(GENRES))}
    }

@app.post("/predict_clip")
async def predict_clip(file: UploadFile = File(...)):
    t0 = time.perf_counter()
    audio_bytes = await file.read()
    y = decode_audio(audio_bytes)
    mel = waveform_to_mel_window(y)
    probs = model.predict_mel(mel)
    latency = (time.perf_counter() - t0) * 1000
    return to_response(probs, latency)

@app.post("/predict_chunk")
async def predict_chunk(file: UploadFile = File(...)):
    """
    Accepts a short audio chunk (e.g., 200–500ms) from the mic.
    Returns a prediction when enough audio is accumulated.
    """
    t0 = time.perf_counter()
    audio_bytes = await file.read()
    y = decode_audio(audio_bytes)  # chunk waveform at SR

    window = stream_buf.push(y)
    if window is None:
        return {
            "ready": False,
            "needed_samples": int(WIN_SAMPLES - stream_buf.buf.shape[0])
        }

    mel = waveform_to_mel_window(window)
    probs = model.predict_mel(mel)
    latency = (time.perf_counter() - t0) * 1000
    resp = to_response(probs, latency)
    resp["ready"] = True
    return resp
