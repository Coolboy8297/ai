# Command AI

A command-driven web interface for local Ollama models. GitHub Pages hosts the interface; Ollama runs on your computer.

## Run locally

Open `index.html` in a browser, or serve this folder with a static web server. Start Ollama first, then choose **Connect to Ollama**.

## Ollama cross-origin access

The hosted GitHub Pages site needs permission to call your local Ollama server. Configure Ollama's `OLLAMA_ORIGINS` to include your exact Pages origin, then restart Ollama. For this repository, that origin will normally be `https://coolboy8297.github.io` if Pages is published as a project site. Browser and operating-system security rules can affect requests from HTTPS pages to localhost; if the hosted site cannot connect, test the interface locally or use a trusted local HTTPS bridge.

Do not expose Ollama's port to the public internet. Keep it bound to your own machine.

## Current commands

- Chat with the selected local Ollama model.
- `/time`: show the browser's current date and time.
- `/models`: refresh the local model list.
- `/clear`: clear the conversation.
- `open https://example.com`: open a website in a new tab.
- Attach an image for analysis with a vision-capable Ollama model.
- Open the webcam and capture a frame for image analysis.

## Limits

This is a static website, so it cannot run arbitrary shell commands or access local files on its own. The webcam requires browser permission. Live object tracking and general-purpose operating-system actions need a separate local companion service and explicit permissions; they are not silently enabled by this page.

Conversation history is held in page memory; the Ollama endpoint setting is stored in browser local storage. Images are sent to the selected local Ollama model when you submit them.
