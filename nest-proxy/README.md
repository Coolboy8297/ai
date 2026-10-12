# NEST restricted page preview API

This is a small Node.js service for NEST Browser. It fetches **HTML-to-text previews** only from a fixed allowlist. It is not a general-purpose proxy, does not render interactive websites, and is not intended to bypass network rules.

## Render settings

- Runtime: Node
- Branch: `main`
- Root Directory: `nest-proxy`
- Build Command: `npm install`
- Start Command: `npm start`
- Instance: Free

No environment variables are required.

## Endpoints

- `/` — service status and approved domains
- `/health` — health check
- `/api/preview?url=https%3A%2F%2Fexample.com` — fetch a text preview for an approved site

## Current approved domains

- example.com
- wikipedia.org (including en.wikipedia.org)
- nasa.gov (including www.nasa.gov)
- github.com (including www.github.com)

Only HTTPS URLs on the explicit list are accepted. Redirect destinations are checked again, responses are limited to HTML and 1 MB, and requests time out after 8 seconds.

To add another site, edit `ALLOWED_HOSTS` in `server.js`, review the domain, then commit the change.
