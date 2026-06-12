"""
Diarizer — Speaker diarization using pyannote.audio 4.x.
Assigns speaker labels (Speaker 1, Speaker 2, …) to time segments.
"""

import os
import io
import wave
from pathlib import Path
import numpy as np
from dotenv import load_dotenv

_BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_BACKEND_ENV)

os.environ.setdefault("MPLCONFIGDIR", "/tmp/acb_matplotlib")
os.environ["HF_HUB_OFFLINE"] = "1"

_DIARIZE_AVAILABLE = False
_DIARIZE_ERROR = None

try:
    import torch
    import torchaudio

    # ── Compatibility shims (must run before pyannote imports) ────────────────

    # 1. torchaudio 2.7+ removed AudioMetaData, list_audio_backends, info
    if not hasattr(torchaudio, "AudioMetaData"):
        from dataclasses import dataclass

        @dataclass
        class _AudioMetaData:
            sample_rate: int
            num_frames: int
            num_channels: int
            bits_per_sample: int
            encoding: str

        torchaudio.AudioMetaData = _AudioMetaData  # type: ignore[attr-defined]

    if not hasattr(torchaudio, "list_audio_backends"):
        def _list_audio_backends():
            return ["soundfile"]
        torchaudio.list_audio_backends = _list_audio_backends  # type: ignore[attr-defined]

    if not hasattr(torchaudio, "info"):
        import soundfile as _sf

        def _torchaudio_info(uri, backend=None):
            info = _sf.info(uri)
            return torchaudio.AudioMetaData(
                sample_rate=info.samplerate,
                num_frames=info.frames,
                num_channels=info.channels,
                bits_per_sample=16,
                encoding="PCM_S",
            )
        torchaudio.info = _torchaudio_info  # type: ignore[attr-defined]

    # 2. huggingface_hub 0.20+ renamed use_auth_token -> token
    import huggingface_hub as _hfh
    _orig_hf_hub_download = _hfh.hf_hub_download

    def _patched_hf_hub_download(*args, **kwargs):
        if "use_auth_token" in kwargs:
            kwargs["token"] = kwargs.pop("use_auth_token")
        return _orig_hf_hub_download(*args, **kwargs)

    _hfh.hf_hub_download = _patched_hf_hub_download
    try:
        import huggingface_hub.file_download as _hfh_fd
        _hfh_fd.hf_hub_download = _patched_hf_hub_download
    except Exception:
        pass

    # 3. Force weights_only=False for pyannote checkpoint loads
    _orig_torch_load = torch.load

    def _patched_torch_load(f, map_location=None, pickle_module=None, weights_only=None, **kwargs):
        return _orig_torch_load(f, map_location=map_location, pickle_module=pickle_module, weights_only=False, **kwargs)

    torch.load = _patched_torch_load

    from pyannote.audio import Pipeline
    _DIARIZE_AVAILABLE = True

except Exception as _e:
    _DIARIZE_ERROR = str(_e)

BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(BACKEND_ENV)
HF_TOKEN = os.getenv("HF_TOKEN", "")


class Diarizer:
    _instance = None  # singleton so the heavy model loads only once

    def __init__(self):
        import torch as _torch
        if not HF_TOKEN:
            raise RuntimeError("HF_TOKEN not set in .env — required for pyannote models")
        device = "cuda" if _torch.cuda.is_available() else "cpu"
        print(f"[Diarizer] Loading pyannote/speaker-diarization-3.1 on {device}…")
        # pyannote.audio <4 uses `use_auth_token`; newer versions renamed it to `token`.
        try:
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=HF_TOKEN,
            )
        except TypeError:
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=HF_TOKEN,
            )
        if device == "cuda":
            self.pipeline = self.pipeline.to(_torch.device("cuda"))
        print("[Diarizer] Model loaded ✓")

    @classmethod
    def get_instance(cls):
        """Lazy singleton — first call triggers the (slow) model download."""
        if not _DIARIZE_AVAILABLE:
            raise RuntimeError(f"Diarization unavailable: {_DIARIZE_ERROR}")
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_wav_as_tensor(self, audio_path: str):
        import torch as _torch
        """Load WAV file as a waveform dict that pyannote accepts (bypasses torchcodec)."""
        with wave.open(audio_path, "rb") as wf:
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            raw = wf.readframes(wf.getnframes())

        if sample_width == 2:
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 1:
            samples = np.frombuffer(raw, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0
        else:
            samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0

        if n_channels > 1:
            samples = samples.reshape(-1, n_channels)[:, 0]

        waveform = _torch.from_numpy(samples).unsqueeze(0)  # (1, num_samples)
        return {"waveform": waveform, "sample_rate": sample_rate}

    def diarize(self, audio_path: str, num_speakers: int = None):
        params = {}
        if num_speakers is not None and num_speakers > 0:
            params["num_speakers"] = num_speakers

        audio_data = self._load_wav_as_tensor(audio_path)
        output = self.pipeline(audio_data, **params)

        if hasattr(output, "speaker_diarization"):
            diarization = output.speaker_diarization
        else:
            diarization = output

        label_map = {}
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            if speaker not in label_map:
                label_map[speaker] = f"Speaker {len(label_map) + 1}"
            segments.append({
                "speaker": label_map[speaker],
                "start": round(turn.start, 2),
                "end": round(turn.end, 2),
            })

        merged = []
        for seg in segments:
            if merged and merged[-1]["speaker"] == seg["speaker"] and seg["start"] - merged[-1]["end"] < 0.5:
                merged[-1]["end"] = seg["end"]
            else:
                merged.append(dict(seg))

        print(f"[Diarizer] {len(merged)} segments, {len(label_map)} speakers detected")
        return merged, len(label_map)

    @staticmethod
    def extract_segment_audio(audio_path: str, start: float, end: float) -> bytes:
        with wave.open(audio_path, "rb") as wf:
            sr = wf.getframerate()
            n_channels = wf.getnchannels()
            sw = wf.getsampwidth()
            start_frame = int(start * sr)
            end_frame = int(end * sr)
            wf.setpos(start_frame)
            raw = wf.readframes(end_frame - start_frame)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as out:
            out.setnchannels(n_channels)
            out.setsampwidth(sw)
            out.setframerate(sr)
            out.writeframes(raw)
        return buf.getvalue()
