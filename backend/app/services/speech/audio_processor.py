"""
AudioProcessor — Converts any audio to 16kHz mono PCM WAV.
Supports WAV, MP3, M4A, OGG, FLAC, WebM, AAC, etc. via ffmpeg.
Includes gentle noise reduction for cleaner transcription.
"""

import os
import shutil
import wave
import subprocess
import numpy as np

try:
    from scipy.signal import butter, sosfiltfilt
    SCIPY_AVAILABLE = True
except Exception:
    SCIPY_AVAILABLE = False

TARGET_SAMPLE_RATE = 16000

# Noise reduction settings (conservative — preserves voice quality)
ENABLE_NOISE_REDUCTION = True
HIGHPASS_CUTOFF_HZ = 80          # remove low-freq rumble / AC hum
NOISE_PROFILE_SECONDS = 0.4      # use first N seconds as noise estimate
NOISE_REDUCTION_STRENGTH = 1.5   # multiplier on noise floor (gentle gating)


class AudioProcessor:
    """Convert any audio to 16kHz mono PCM WAV."""

    def process_audio(self, input_path: str) -> str:
        """Process audio file → 16kHz mono WAV."""
        output_path = input_path.rsplit('.', 1)[0] + '_processed.wav'
        ext = os.path.splitext(input_path)[1].lower()

        print(f"  🔊 Processing: {os.path.basename(input_path)} (ext={ext})")

        # If not a valid WAV, convert using ffmpeg
        if not self._is_valid_wav(input_path):
            wav_path = input_path.rsplit('.', 1)[0] + '_converted.wav'
            self._convert_to_wav(input_path, wav_path)
            input_path = wav_path

        # Read the WAV file
        samples, sr = self._read_wav(input_path)

        if samples is None or len(samples) == 0:
            raise ValueError("No audio data found in file")

        print(f"  📊 Read: {len(samples)} samples @ {sr}Hz, duration={len(samples)/sr:.1f}s")

        # Check amplitude
        max_amp = float(np.max(np.abs(samples)))
        print(f"  📊 Max amplitude: {max_amp:.6f}")

        if max_amp < 0.001:
            print("  ⚠️ Warning: Audio appears to be very quiet/silent!")

        # Resample to 16kHz first (cleaner noise reduction at target rate)
        if sr != TARGET_SAMPLE_RATE:
            samples = self._resample(samples, sr, TARGET_SAMPLE_RATE)
            sr = TARGET_SAMPLE_RATE
            print(f"  📊 Resampled: {len(samples)} samples @ {TARGET_SAMPLE_RATE}Hz")

        # 🔇 Noise reduction (gentle — preserves voice)
        if ENABLE_NOISE_REDUCTION and SCIPY_AVAILABLE and len(samples) > sr * 0.5:
            try:
                samples = self._reduce_noise(samples, sr)
                print(f"  🔇 Noise reduction applied (HPF {HIGHPASS_CUTOFF_HZ}Hz + spectral gate)")
            except Exception as e:
                print(f"  ⚠️ Noise reduction skipped: {e}")

        # Strong Normalization for Whisper (after denoising)
        max_amp = float(np.max(np.abs(samples)))
        if max_amp > 0:
            samples = samples / max_amp * 0.95
            print(f"  📊 Normalized audio (Gain boost to 0.95 peak)")

        # Write 16-bit PCM WAV
        self._write_wav(output_path, samples, TARGET_SAMPLE_RATE)
        print(f"  ✅ Output: {output_path} ({os.path.getsize(output_path)} bytes)")

        # Clean up intermediate converted file
        converted = input_path.rsplit('.', 1)[0] + '_converted.wav'  
        if os.path.exists(converted) and converted != output_path:
            try:
                os.remove(converted)
            except Exception:
                pass

        return output_path

    def _is_valid_wav(self, path: str) -> bool:
        """Check if file is actually a valid WAV (starts with RIFF header)."""
        try:
            with open(path, 'rb') as f:
                header = f.read(4)
            return header == b'RIFF'
        except Exception:
            return False

    def _ffmpeg_candidates(self):
        """Return ffmpeg executables in preferred order."""
        candidates = []

        env_binary = os.getenv("FFMPEG_BINARY")
        if env_binary:
            candidates.append(env_binary)

        try:
            import imageio_ffmpeg

            candidates.append(imageio_ffmpeg.get_ffmpeg_exe())
        except Exception:
            pass

        system_binary = shutil.which("ffmpeg")
        if system_binary:
            candidates.append(system_binary)
        candidates.append("ffmpeg")

        seen = set()
        unique = []
        for candidate in candidates:
            if candidate and candidate not in seen:
                seen.add(candidate)
                unique.append(candidate)
        return unique

    def _convert_to_wav(self, input_path: str, output_path: str):
        """Convert any audio/video format to WAV using ffmpeg."""
        errors = []
        for ffmpeg_binary in self._ffmpeg_candidates():
            cmd = [
                ffmpeg_binary,
                '-y',
                '-i', input_path,
                '-map', '0:a:0',       # first audio stream, works for MP4/MOV/WebM
                '-vn',                 # ignore video frames
                '-ac', '1',           # mono
                '-ar', str(TARGET_SAMPLE_RATE),  # 16kHz
                '-sample_fmt', 's16',  # 16-bit PCM
                '-f', 'wav',
                output_path,
            ]
            try:
                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=120
                )
                if result.returncode == 0:
                    print(f"  🔄 Converted with {ffmpeg_binary}: {os.path.basename(output_path)} ({os.path.getsize(output_path)} bytes)")
                    return

                stderr = result.stderr[-700:] if result.stderr else "unknown ffmpeg error"
                errors.append(f"{ffmpeg_binary}: {stderr}")
            except FileNotFoundError:
                errors.append(f"{ffmpeg_binary}: not found")
            except subprocess.TimeoutExpired:
                raise ValueError("Audio/video conversion timed out (>120s)")

        joined_errors = "\n".join(errors[-3:])
        if "Stream map '0:a:0' matches no streams" in joined_errors:
            raise ValueError("No audio track found in this media file.")
        raise ValueError(
            "ffmpeg could not extract audio from this file. "
            "Install a working ffmpeg or run `pip install imageio-ffmpeg` in the backend venv.\n"
            f"{joined_errors}"
        )

    def _read_wav(self, path: str):
        """Read WAV file."""
        try:
            with wave.open(path, "rb") as wf:
                n_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                frame_rate = wf.getframerate()
                n_frames = wf.getnframes()
                raw_data = wf.readframes(n_frames)

            print(f"  📦 WAV: {n_channels}ch, {sample_width*8}bit, {frame_rate}Hz, {n_frames} frames")

            if sample_width == 2:
                samples = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32) / 32768.0
            elif sample_width == 1:
                samples = np.frombuffer(raw_data, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0
            elif sample_width == 4:
                samples = np.frombuffer(raw_data, dtype=np.int32).astype(np.float32) / 2147483648.0
            else:
                raise ValueError(f"Unsupported sample width: {sample_width}")

            # Convert to mono if stereo
            if n_channels > 1:
                samples = samples.reshape(-1, n_channels)[:, 0]

            return samples, frame_rate

        except Exception as e:
            raise ValueError(f"Cannot read audio file: {e}")

    def _resample(self, samples, from_rate, to_rate):
        """Linear interpolation resampling."""
        if from_rate == to_rate:
            return samples
        duration = len(samples) / from_rate
        new_length = int(duration * to_rate)
        indices = np.linspace(0, len(samples) - 1, new_length)
        return np.interp(indices, np.arange(len(samples)), samples).astype(np.float32)

    def _reduce_noise(self, samples: np.ndarray, sr: int) -> np.ndarray:
        """
        Gentle noise reduction:
          1) High-pass filter to remove low-freq rumble / AC hum (50/60 Hz)
          2) Spectral gating: estimate noise floor from quiet portion,
             attenuate frequency bins below noise threshold.
        Designed to be conservative — does NOT damage voice intelligibility.
        """
        # --- 1. High-pass filter ---
        nyq = sr / 2.0
        cutoff = HIGHPASS_CUTOFF_HZ / nyq
        sos = butter(4, cutoff, btype='highpass', output='sos')
        filtered = sosfiltfilt(sos, samples).astype(np.float32)

        # --- 2. Spectral gating noise reduction ---
        # Use scipy's STFT for noise profile estimation
        try:
            from scipy.signal import stft, istft
        except Exception:
            return filtered  # HPF already applied

        n_fft = 512
        hop = 128

        # Compute STFT
        f, t, Zxx = stft(filtered, fs=sr, nperseg=n_fft, noverlap=n_fft - hop)
        mag = np.abs(Zxx)
        phase = np.angle(Zxx)

        # Estimate noise profile from first NOISE_PROFILE_SECONDS
        noise_frames = max(1, int(NOISE_PROFILE_SECONDS * sr / hop))
        noise_frames = min(noise_frames, mag.shape[1] // 4)  # cap at 25% of audio
        noise_profile = np.mean(mag[:, :noise_frames], axis=1, keepdims=True)

        # Build soft mask: attenuate bins where magnitude is near noise level
        threshold = noise_profile * NOISE_REDUCTION_STRENGTH
        # Soft mask between 0.1 (heavily attenuate) and 1.0 (keep)
        mask = np.clip((mag - threshold) / (mag + 1e-10), 0.1, 1.0)
        mag_clean = mag * mask

        # Reconstruct signal
        Zxx_clean = mag_clean * np.exp(1j * phase)
        _, cleaned = istft(Zxx_clean, fs=sr, nperseg=n_fft, noverlap=n_fft - hop)

        # Match length to input
        if len(cleaned) > len(filtered):
            cleaned = cleaned[:len(filtered)]
        elif len(cleaned) < len(filtered):
            cleaned = np.pad(cleaned, (0, len(filtered) - len(cleaned)))

        return cleaned.astype(np.float32)

    def _write_wav(self, path, samples, sample_rate):
        """Write float32 samples as 16-bit PCM WAV."""
        samples_clipped = np.clip(samples, -1.0, 1.0)
        int_samples = (samples_clipped * 32767).astype(np.int16)
        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(int_samples.tobytes())
