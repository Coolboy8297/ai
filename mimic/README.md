# Mimic interface

This folder contains the browser UI for the unseen Mimic-inspired chat character.

## Features
- Text chat and browser speech input/output
- Camera preview and face matching in the browser
- Locally stored face descriptors and user-assigned names
- Ollama Cloud chat through a separate server endpoint

## Important deployment detail
GitHub Pages only serves static files. It cannot run `api/mimic.js`. The API file at the repository root is a Vercel serverless function and must be deployed to a Vercel project that uses this repository. In Vercel Project Settings → Environment Variables, add:

- `OLLAMA_API_KEY`: your Ollama Cloud API key (keep it secret; never put it in HTML or GitHub)
- `OLLAMA_MODEL`: optional model name available to your Ollama Cloud account

After deployment, open the Mimic page at `https://coolboy8297.github.io/ai/mimic/`, expand Connection & behavior settings, and enter the deployed function URL, for example `https://YOUR-VERCEL-DOMAIN/api/mimic`.

If the Vercel project currently deploys the existing site, adding the API file may enable the endpoint on that deployment. If it does not, create a Vercel project from this same repository and set the root directory to the repository root. Do not expose your API key in client-side code.

## Face data and permissions
Camera access requires HTTPS and permission from the browser. Names and face descriptors are saved in local storage on the current browser. They are not synced between devices. Remove a person's profile from the People list to delete it. Face matching is experimental and may misidentify people; it does not identify strangers' real-world identities by itself.

## Notes
- Speech recognition availability varies by browser. It may use the browser's speech service and may require an internet connection.
- The face-recognition library and its model weights are downloaded from public CDNs when camera recognition is enabled.
- This is an initial build; do not treat it as a security or identity-verification system.
