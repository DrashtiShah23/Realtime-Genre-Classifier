# Real-Time Music Genre Classification

Full-stack ML system for real-time music genre classification using a CNN trained on mel-spectrogram features. 
Supports live microphone streaming and audio file uploads. Backend built with FastAPI. Frontend built with TypeScript.


## Architecture

```
                ┌────────────────────┐
                │  Microphone / File │
                └──────────┬─────────┘
                           │
                           ▼
                ┌────────────────────┐
                │ Mel-Spectrogram    │
                │ Feature Extraction │
                └──────────┬─────────┘
                           │
                           ▼
                ┌────────────────────┐
                │   CNN Classifier   │
                │   (TensorFlow)     │
                └──────────┬─────────┘
                           │
                           ▼
                ┌────────────────────┐
                │   FastAPI Server   │
                └──────────┬─────────┘
                           │
                           ▼
                ┌────────────────────┐
                │ Frontend (TS/WebGL)│
                └────────────────────┘
```



## System Design

**Backend**

* FastAPI inference service
* Model loaded once at startup
* Deterministic mel-spectrogram preprocessing
* Sliding window buffer for streaming stability

**Frontend**

* Microphone capture + file upload
* Chunked streaming to backend
* Real-time probability rendering
* Modular separation of API, audio, and visualization logic

Training and inference environments are decoupled.

---

## Model

* Input: Mel-spectrogram representation
* Architecture: Convolutional Neural Network
* Output: Multi-class genre probability distribution
* Loss: Categorical Cross-Entropy
* Optimizer: Adam

---

## Setup

### Backend

```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

### Frontend

```
cd frontend
npm install
npm run dev
```

---

## Notes

* Training data and artifacts are excluded from version control.
* Designed to reflect production ML service structure.
* Emphasis on modular preprocessing, streaming inference, and clean backend/frontend separation.

---


Tell me which one you want.
