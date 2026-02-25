const API = "http://localhost:8000";

export async function predictClip(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API}/predict_clip`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`predict_clip failed: ${res.status}`);
  return res.json();
}

export async function predictChunk(wavBlob: Blob) {
  const fd = new FormData();
  fd.append("file", wavBlob, "chunk.wav");
  const res = await fetch(`${API}/predict_chunk`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`predict_chunk failed: ${res.status}`);
  return res.json();
}
