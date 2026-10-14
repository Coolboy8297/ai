# SERVERFORGE

SERVERFORGE is a GitHub Pages-friendly dashboard prototype for creating and managing Minecraft server profiles.

## Current status

- Responsive dashboard and navigation
- Create/edit/delete server profiles
- Server software, Minecraft version, memory target, player limit, MOTD, and configuration notes
- Profiles persist in the current browser using localStorage
- Optional health-check field for testing a future HTTPS backend
- Console clearly reports that live server control is not connected

**This is not yet a live hosting service.** Saving a profile does not provision or start a Minecraft server. GitHub Pages serves static files and cannot run persistent Minecraft processes.

## Open the dashboard

After the repository's Pages deployment publishes the folder:

https://coolboy8297.github.io/ai/serverforge/

If the link returns 404, check the repository's Pages deployment workflow and wait for the latest deployment to finish.

## Next: connect a real free host

Before implementing a provider adapter, verify that the chosen host offers an API that permits the required actions on its free tier. A control panel alone does not mean automated provisioning is supported.

Recommended architecture:

1. **Static frontend** — this folder on GitHub Pages.
2. **Backend API** — a small HTTPS service that authenticates the user, validates inputs, applies quotas, and talks to the hosting provider.
3. **Minecraft runtime** — the provider's actual server infrastructure.
4. **Status/console API** — reports real state and logs to the dashboard.

Never place a provider API key, account password, or private token in this repository or browser JavaScript. Keep credentials in backend environment secrets. Require authentication and authorization for every mutating endpoint, validate software/version combinations, rate-limit requests, and never execute user-submitted shell code as a privileged process.

## Suggested backend contract

- `GET /health` — service health
- `GET /api/servers` — servers belonging to the authenticated user
- `POST /api/servers` — validate and create a server through the provider
- `GET /api/servers/:id` — authoritative status
- `POST /api/servers/:id/start` — start
- `POST /api/servers/:id/stop` — stop
- `GET /api/servers/:id/console` — fetch logs
- `POST /api/servers/:id/console` — send an allowlisted console command

The frontend should only show a server as running after the backend returns confirmed provider state. Never infer success from a button click.

## Development

Open `index.html` in a browser. No build step is required. Profiles are browser-local and are not synced across devices or users.
