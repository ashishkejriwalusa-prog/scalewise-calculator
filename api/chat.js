module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const previousResponseId = typeof req.body?.previousResponseId === 'string'
    ? req.body.previousResponseId.trim()
    : '';

  if (!message) {
    return res.status(400).json({
      error: 'missing_message',
      reply: 'Please type a question so ScaleWise AI can help.',
    });
  }

  if (message.length > 3000) {
    return res.status(413).json({
      error: 'message_too_long',
      reply: 'Please shorten the message and try again.',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'not_configured',
      configured: false,
      reply: 'The live ScaleWise AI agent is installed in the website code, but the OpenAI API key still needs to be added in the deployment environment. Please contact info@scalewise.group for immediate help.',
    });
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
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
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
      return res.status(502).json({
        error: 'provider_error',
        configured: true,
        reply: 'ScaleWise AI could not complete that request right now. Please try again or contact info@scalewise.group.',
        providerMessage: data?.error?.message || 'OpenAI request failed.',
      });
    }

    const reply = extractText(data) || 'Thanks for your question. Please contact info@scalewise.group so the ScaleWise team can help directly.';

    return res.status(200).json({
      configured: true,
      reply,
      responseId: data.id || null,
    });
  } catch (error) {
    return res.status(502).json({
      error: 'network_error',
      configured: true,
      reply: 'ScaleWise AI could not reach the live answer service right now. Please try again or contact info@scalewise.group.',
    });
  }
};

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
