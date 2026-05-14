exports.handler = async function handler(event) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, headers);
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return json(400, {
      error: 'invalid_json',
      reply: 'Please send a valid chat message.',
    }, headers);
  }

  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const previousResponseId = typeof body?.previousResponseId === 'string'
    ? body.previousResponseId.trim()
    : '';

  if (!message) {
    return json(400, {
      error: 'missing_message',
      reply: 'Please type a question so ScaleWise AI can help.',
    }, headers);
  }

  if (message.length > 3000) {
    return json(413, {
      error: 'message_too_long',
      reply: 'Please shorten the message and try again.',
    }, headers);
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(503, {
      error: 'not_configured',
      configured: false,
      reply: 'The live ScaleWise AI agent is installed in the website code, but the OpenAI API key still needs to be added in Netlify environment variables. Please contact info@scalewise.group for immediate help.',
    }, headers);
  }

  const instructions = `You are ScaleWise AI, the official customer-facing business assistant for ScaleWise Group.

Goals:
- Answer website visitor questions warmly, professionally, and accurately.
- Explain ScaleWise services, fit, process, and business value.
- Help with bookkeeping, accounting, AP/AR, reconciliations, reporting preparation, tax-ready workflows, FP&A, controller-style execution, offshore finance delivery, CPA firm support, and restaurant bookkeeping.

ScaleWise facts you may state:
- ScaleWise Group / ScaleWise provides finance and accounting support for growing businesses and CPA firms.
- Public contact email: info@scalewise.group.
- Public phone: +1 307 285 0020.
- Public address shown on the website: 30 N Gould St Ste 61480, Sheridan, WY 82801.
- ScaleWise positions its model around U.S.-facing client leadership and India-based delivery capacity.

Guardrails:
- Never fabricate ScaleWise pricing, client names, credentials, guarantees, delivery timelines, contract terms, or legal commitments.
- For pricing, explain that pricing depends on transaction volume, number of entities, reporting needs, cleanup needs, complexity, and advisory scope. Offer a team handoff.
- For proposals, contracts, confidential matters, account-specific issues, or binding commitments, say: “For this, let me connect you with our team at ScaleWise — they’ll be able to help you directly.”
- Do not present general tax, accounting, or compliance information as individualized legal or tax advice.
- Keep responses focused, clear, and useful. Use short paragraphs or bullets only when they improve readability.
- End naturally with an invitation to continue or contact the team when appropriate.`;

  const payload = {
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    instructions,
    input: message,
    store: true,
    max_output_tokens: 700,
  };

  if (previousResponseId) {
    payload.previous_response_id = previousResponseId;
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return json(502, {
        error: 'provider_error',
        configured: true,
        reply: 'ScaleWise AI could not complete that request right now. Please try again or contact info@scalewise.group.',
        providerMessage: data?.error?.message || 'OpenAI request failed.',
      }, headers);
    }

    const reply = extractText(data)
      || 'Thanks for your question. Please contact info@scalewise.group so the ScaleWise team can help directly.';

    return json(200, {
      configured: true,
      reply,
      responseId: data.id || null,
    }, headers);
  } catch (error) {
    return json(502, {
      error: 'network_error',
      configured: true,
      reply: 'ScaleWise AI could not reach the live answer service right now. Please try again or contact info@scalewise.group.',
    }, headers);
  }
};

function json(statusCode, body, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function extractText(response) {
  const chunks = [];
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join('\n').trim();
}
