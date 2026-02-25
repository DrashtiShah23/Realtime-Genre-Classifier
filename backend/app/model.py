import tensorflow as tf
import numpy as np

class GenreModel:
    def __init__(self, model_dir: str):
        self.model = tf.saved_model.load(model_dir)
        self.infer = self.model.signatures["serving_default"]

    def predict_mel(self, mel_128x256: np.ndarray) -> np.ndarray:
        x = mel_128x256[None, ..., None].astype(np.float32)  # (1,128,256,1)
        out = self.infer(tf.constant(x))
        probs = list(out.values())[0].numpy()[0]  # (10,)
        return probs
