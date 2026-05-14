# ScaleWise Live AI Agent Setup

The website code now includes a real server-side chat endpoint at `api/chat.js` and a homepage widget that calls `/api/chat`.

## To activate live answers
1. Deploy this repository to a serverless host that supports API routes, such as Vercel.
2. Add the environment variable `OPENAI_API_KEY` in the hosting dashboard.
3. Optionally add `OPENAI_MODEL` to override the default model.
4. Redeploy the site.

## Current behavior
- Without `OPENAI_API_KEY`, the widget stays visible but returns a clear setup message.
- With `OPENAI_API_KEY`, the widget sends visitor questions to the OpenAI Responses API through a secure backend route.
- The browser never sees the API key.
- Follow-up turns preserve conversation context using `previous_response_id`.

## Notes
- Static-only GitHub Pages cannot execute `api/chat.js`.
- The live agent should be deployed on a serverless host or equivalent backend platform.
