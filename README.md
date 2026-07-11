# Drave AI Check

Vite + React dashboard for device inspections, structured for Cloudflare Pages.

## Architecture

- Each inspection area is rendered as an independent screen and exchanges JSON-shaped report data.
- `functions/api/inspections.ts` provides the Cloudflare Pages API boundary for scanner uploads and report retrieval.
- D1 is reserved for inspection metadata; R2 stores immutable JSON report payloads.
- Replace the demo JSON response with the scanner/AI service without changing the dashboard contract.

## Run

```bash
npm install
npm run dev
npm run build
```
