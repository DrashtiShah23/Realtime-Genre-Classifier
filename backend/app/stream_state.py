import numpy as np
from dataclasses import dataclass

@dataclass
class StreamBuffer:
    sr: int
    win_samples: int
    max_samples: int

    def __post_init__(self):
        self.buf = np.zeros((0,), dtype=np.float32)

    def push(self, x: np.ndarray) -> np.ndarray:
        # append
        self.buf = np.concatenate([self.buf, x.astype(np.float32)], axis=0)
        # keep last max_samples
        if self.buf.shape[0] > self.max_samples:
            self.buf = self.buf[-self.max_samples:]
        # return last window if available
        if self.buf.shape[0] >= self.win_samples:
            return self.buf[-self.win_samples:]
        return None
