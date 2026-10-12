#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. On Debian: sudo apt install python3"
  exit 1
fi
if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama was not found. Install/start Ollama first."
  exit 1
fi
if ! curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Starting Ollama service..."
  (ollama serve >/tmp/command-ai-ollama.log 2>&1 &)
  sleep 2
fi
exec python3 agent.py
