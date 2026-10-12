# COMMAND AI

A public, browser-based AI assistant hosted on GitHub Pages. It runs an open-weight language model on the visitor's own device using WebGPU—no Ollama, Python, account, API key, or personal server required.

## Use the website

1. Open the published GitHub Pages URL.
2. Choose the smaller Qwen 2.5 0.5B model to start, or try the 1.5B model if your device has enough memory.
3. Press **Load AI model** and wait for the model to download and initialize.
4. Start chatting. The browser may cache the model for later visits.

The first model download can be hundreds of megabytes or more. A compatible browser with WebGPU and sufficient available memory is required; performance depends on the visitor's device. The model runs on-device after download, so prompts are not sent to a COMMAND AI inference server.

## Built-in modules

- Local browser inference through WebLLM/WebGPU.
- Bounded agent loop for tool requests.
- Calculator with arithmetic-only input validation.
- Current local time and timezone.
- Open a requested HTTP/HTTPS website in a new tab.
- Read text files only after the visitor explicitly selects them; files are limited in size.
- Conversation history for the current page session and clear-chat control.

## Important limits

This is a static GitHub Pages app, not a remote computer-control service. It cannot access a visitor's private filesystem without a file picker, execute shell commands, control other apps, or run Ollama on the website's server. Image vision and live webcam analysis are not currently implemented in the browser version. There is no hosted cloud-model fallback, so browsers without WebGPU or devices without enough memory cannot run the included models yet.

The web app imports WebLLM from `https://esm.run/@mlc-ai/web-llm` and downloads model artifacts when requested. Those third-party assets are necessary for browser inference.

## Deploy to GitHub Pages

In the repository, open **Settings → Pages → Build and deployment** and choose **GitHub Actions** as the source. The workflow in `.github/workflows/pages.yml` then publishes the static site on pushes to `main`.

Expected site address: https://coolboy8297.github.io/ai/

## Project layout

- `index.html` — complete public browser app.
- `.github/workflows/pages.yml` — static GitHub Pages deployment.
