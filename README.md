# COMMAND AI

COMMAND AI is a modular local AI assistant UI for Ollama. GitHub hosts the source; run the companion on your Debian/Linux computer for local model access and approved tools.

## Quick start (Debian/Linux)

1. Make sure Ollama is installed and a model is downloaded, for example `ollama pull qwen2.5:1.5b`.
2. Open a terminal in this repository folder.
3. Run `chmod +x start.sh && ./start.sh`.
4. Open **http://127.0.0.1:8765** in your browser.
5. Press Connect, choose a model, then enable Agent mode for tool use.

The companion uses Python's standard library; no pip packages or virtual environment are required. It proxies requests to Ollama and serves the UI on localhost, avoiding the common GitHub Pages-to-local-Ollama CORS problem. Set `OLLAMA_HOST` or `COMMAND_AI_PORT` environment variables to customize the endpoints.

## Current capabilities

- Chat with installed local Ollama models; image attachments and one-shot webcam capture work with vision-capable models.
- Agent mode: the model can request bounded tools and use their results in a short tool loop.
- Tools: system information, local Ollama model list, list files in the home folder, read small text files in the home folder, and a strict safe-command allowlist (`pwd`, `whoami`, `date`, `uname -a`, `df -h`, `free -h`, `uptime`, `python --version`, `ollama list`, `git status`).
- `/time`, `/models`, `/clear`, and `open https://example.com`.
- No third-party dependencies.

## Safety and limitations

This is intentionally **not** unrestricted remote shell access. The companion binds only to `127.0.0.1`, restricts file access to your home folder, only reads files, and only runs exact allowlisted commands. It does not install software, delete files, modify system settings, control other apps, continuously monitor the webcam, or perform background surveillance. Those features would require additional explicit permission and separate implementation.

Images are sent to the selected local Ollama model. Webcam use requires browser permission and is only started after pressing the camera button. Conversation content stays in browser memory unless you choose to send it to the local model. Do not expose the companion or Ollama ports to the public internet.

## GitHub Pages

The Pages site can host the static UI, but for best results use the local companion at `http://127.0.0.1:8765`. Enable **Settings → Pages → Build and deployment → GitHub Actions** to publish the static site. GitHub Pages cannot itself host the Python companion process.
