# ScaleWise Live AI Agent Setup — Netlify

The website code now includes a Netlify serverless function at `netlify/functions/chat.js` and the homepage chat widget calls `/api/chat`.

## To activate live answers on Netlify
1. Create or open your Netlify site connected to this GitHub repository.
2. Confirm the repository deploys from the `main` branch.
3. Add the environment variable `OPENAI_API_KEY` in Netlify:
   - Site configuration → Environment variables → Add a variable
4. Optionally add `OPENAI_MODEL` to override the default model.
5. Trigger a new Netlify deploy.

## Routing
`netlify.toml` rewrites:

- `/api/chat` → `/.netlify/functions/chat`

This keeps the website widget endpoint clean while Netlify runs the backend securely.

## Current behavior
- Without `OPENAI_API_KEY`, the widget stays visible but returns a clear setup message.
- With `OPENAI_API_KEY`, the widget sends visitor questions to the OpenAI Responses API through the Netlify Function.
- The browser never sees the API key.
- Follow-up turns preserve conversation context using `previous_response_id`.

## Notes
- Static-only GitHub Pages cannot execute Netlify Functions.
- The live agent should be deployed from Netlify so `netlify/functions/chat.js` runs server-side.
