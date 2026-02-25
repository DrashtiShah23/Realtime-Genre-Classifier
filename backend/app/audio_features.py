import io
import numpy as np
import soundfile as sf
import tensorflow as tf

SR = 22050
N_FFT = 2048
HOP = 512
N_MELS = 128
FRAMES = 256

# Cached mel weight matrix (built once)
_mel_w = tf.signal.linear_to_mel_weight_matrix(
    num_mel_bins=N_MELS,
    num_spectrogram_bins=N_FFT // 2 + 1,
    sample_rate=SR,
    lower_edge_hertz=0.0,
    upper_edge_hertz=SR / 2.0,
)

@tf.function(reduce_retracing=True)
def _wave_to_mel_db_norm(wave: tf.Tensor) -> tf.Tensor:
    """
    wave: (T,) float32 at SR
    returns: (128, 256) float32
    """
    # STFT -> power spectrogram
    stft = tf.signal.stft(
        wave,
        frame_length=N_FFT,
        frame_step=HOP,
        fft_length=N_FFT,
        window_fn=tf.signal.hann_window,
        pad_end=True,
    )
    spec = tf.abs(stft) ** 2  # (time, freq)

    # Mel projection
    mel = tf.matmul(spec, _mel_w)  # (time, mel)
    mel = tf.transpose(mel)        # (mel, time)

    # Log (dB-ish): log(1 + x)
    mel = tf.math.log1p(mel)

    # Force exactly FRAMES
    t = tf.shape(mel)[1]
    mel = tf.cond(
        t < FRAMES,
        lambda: tf.pad(mel, [[0, 0], [0, FRAMES - t]]),
        lambda: mel[:, :FRAMES],
    )

    # Normalize per-window (matches your streaming behavior)
    mean = tf.reduce_mean(mel)
    std = tf.math.reduce_std(mel) + 1e-6
    mel = (mel - mean) / std

    return mel

def decode_audio(audio_bytes: bytes) -> np.ndarray:
    """
    Decode bytes -> waveform at SR. Uses soundfile to read and librosa to resample
    if needed (librosa.resample works across TF builds).
    """
    import librosa  # local import ok here; librosa is already in training deps

    y, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)

    if sr != SR:
        # librosa.resample expects 1D array, returns float64 by default -> cast to float32
        y = librosa.resample(y, orig_sr=sr, target_sr=SR).astype(np.float32)

    return y.astype(np.float32)


def waveform_to_mel_window(y: np.ndarray) -> np.ndarray:
    y_tf = tf.convert_to_tensor(y, dtype=tf.float32)
    mel = _wave_to_mel_db_norm(y_tf)
    return mel.numpy().astype(np.float32)  # (128,256)
