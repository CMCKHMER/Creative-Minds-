#!/usr/bin/env python3
"""Generate human-sounding lesson narration with Kokoro-82M (free, Apache-2.0 weights).

Input  : a lesson JSON file, e.g.
           { "id": "lesson-demo", "title": "Demo", "paragraphs": ["First paragraph.", "Second."] }
Output : <out>/<id>/clip-001.mp3 ... clip-NNN.mp3  and  <out>/<id>/manifest.json

The model files are NOT stored in the repo. Download them once, outside the repo:
  kokoro-v1.0.onnx  and  voices-v1.0.bin
  from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
and point to them with --model / --voices (or KOKORO_MODEL / KOKORO_VOICES).

Usage:
  pip install kokoro-onnx soundfile
  python scripts/generate_lesson_audio.py lesson.json --dry-run       # plan clips, no model needed
  python scripts/generate_lesson_audio.py lesson.json                 # render MP3 clips
  python scripts/generate_lesson_audio.py --list-voices               # show available voices
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_MODEL = os.environ.get("KOKORO_MODEL", str(Path.home() / "kokoro-models" / "kokoro-v1.0.onnx"))
DEFAULT_VOICES = os.environ.get("KOKORO_VOICES", str(Path.home() / "kokoro-models" / "voices-v1.0.bin"))
DEFAULT_VOICE = "af_heart"          # Kokoro's top-rated American female voice
DEFAULT_SPEED = 0.95                # slightly slower than natural — suits lessons
DEFAULT_LANG = "en-us"
MAX_CLIP_CHARS = 320                # keeps each clip well inside the model's limit

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
SENTENCE_RE = re.compile(r"[^.!?]+[.!?]+[\"')\]]*|[^.!?]+$")


def split_sentences(paragraph: str) -> list[str]:
    clean = re.sub(r"\s+", " ", paragraph).strip()
    if not clean:
        return []
    return [s.strip() for s in SENTENCE_RE.findall(clean) if s.strip()]


def chunk_text(paragraphs: list[str], max_chars: int = MAX_CLIP_CHARS) -> list[str]:
    """Group sentences into clips of at most max_chars, never splitting a sentence.
    A paragraph break always starts a new clip, so pauses fall at natural points."""
    clips: list[str] = []
    for para in paragraphs:
        current = ""
        for sentence in split_sentences(para):
            if len(sentence) > max_chars:
                # Very long sentence: break at the last comma/space before the limit.
                parts = re.split(r"(?<=[,;:])\s+", sentence)
                pieces: list[str] = []
                buf = ""
                for part in parts:
                    if buf and len(buf) + 1 + len(part) > max_chars:
                        pieces.append(buf)
                        buf = part
                    else:
                        buf = f"{buf} {part}".strip()
                if buf:
                    pieces.append(buf)
                for piece in pieces:
                    if current and len(current) + 1 + len(piece) > max_chars:
                        clips.append(current)
                        current = piece
                    else:
                        current = f"{current} {piece}".strip()
                continue
            if current and len(current) + 1 + len(sentence) > max_chars:
                clips.append(current)
                current = sentence
            else:
                current = f"{current} {sentence}".strip()
        if current:
            clips.append(current)
    return clips


def load_lesson(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    lesson_id = str(data.get("id", "")).strip()
    if not ID_RE.match(lesson_id):
        raise SystemExit(f"Lesson id must be lowercase letters, digits and dashes: {lesson_id!r}")
    paragraphs = data.get("paragraphs")
    if not isinstance(paragraphs, list) or not all(isinstance(p, str) for p in paragraphs):
        raise SystemExit("'paragraphs' must be a list of strings")
    if not any(p.strip() for p in paragraphs):
        raise SystemExit("Lesson has no text to narrate")
    return {"id": lesson_id, "title": str(data.get("title", lesson_id)), "paragraphs": paragraphs}


def build_manifest(lesson: dict, clips: list[str], files: list[str], seconds: list[float],
                   voice: str, speed: float) -> dict:
    return {
        "id": lesson["id"],
        "title": lesson["title"],
        "voice": voice,
        "speed": speed,
        "model": "Kokoro-82M (Apache-2.0)",
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "clips": [
            {"file": f, "text": t, "seconds": round(s, 2)}
            for f, t, s in zip(files, clips, seconds)
        ],
    }


def render(lesson: dict, clips: list[str], out_dir: Path, voice: str, speed: float,
           model_path: str, voices_path: str) -> dict:
    try:
        import numpy as np
        import soundfile as sf
        from kokoro_onnx import Kokoro
    except ImportError as exc:  # pragma: no cover - environment issue
        raise SystemExit(f"Missing dependency ({exc}). Run: pip install kokoro-onnx soundfile") from exc

    for path, label in ((model_path, "model"), (voices_path, "voices")):
        if not Path(path).is_file():
            raise SystemExit(f"Kokoro {label} file not found: {path}\n"
                             "Download it from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0")

    kokoro = Kokoro(model_path, voices_path)
    if voice not in kokoro.get_voices():
        raise SystemExit(f"Unknown voice {voice!r}. Run with --list-voices.")

    out_dir.mkdir(parents=True, exist_ok=True)
    files: list[str] = []
    seconds: list[float] = []
    for i, text in enumerate(clips, start=1):
        samples, rate = kokoro.create(text, voice=voice, speed=speed, lang=DEFAULT_LANG)
        name = f"clip-{i:03d}.mp3"
        sf.write(str(out_dir / name), np.asarray(samples, dtype=np.float32), rate, format="MP3")
        files.append(name)
        seconds.append(len(samples) / float(rate))
        print(f"  [{i}/{len(clips)}] {name}  {seconds[-1]:.1f}s", flush=True)
    return build_manifest(lesson, clips, files, seconds, voice, speed)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lesson", nargs="?", type=Path, help="lesson JSON file")
    parser.add_argument("--out", type=Path, default=Path("public/audio/lessons"), help="output root (default: public/audio/lessons)")
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--voices", default=DEFAULT_VOICES)
    parser.add_argument("--dry-run", action="store_true", help="validate and print the clip plan; render nothing")
    parser.add_argument("--list-voices", action="store_true", help="list voices in the voices file and exit")
    args = parser.parse_args(argv)

    if args.list_voices:
        from kokoro_onnx import Kokoro  # type: ignore
        print("\n".join(Kokoro(args.model, args.voices).get_voices()))
        return 0

    if args.lesson is None:
        parser.error("lesson JSON file is required")
    if not 0.5 <= args.speed <= 2.0:
        parser.error("--speed must be between 0.5 and 2.0")

    lesson = load_lesson(args.lesson)
    clips = chunk_text(lesson["paragraphs"])
    total_chars = sum(len(c) for c in clips)
    print(f"Lesson '{lesson['id']}': {len(clips)} clips, {total_chars} characters, voice {args.voice}, speed {args.speed}")
    for i, text in enumerate(clips, start=1):
        print(f"  clip-{i:03d} ({len(text)} chars): {text[:70]}{'…' if len(text) > 70 else ''}")

    if args.dry_run:
        print("Dry run — nothing rendered.")
        return 0

    out_dir = args.out / lesson["id"]
    manifest = render(lesson, clips, out_dir, args.voice, args.speed, args.model, args.voices)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(clips)} clips and manifest.json to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
