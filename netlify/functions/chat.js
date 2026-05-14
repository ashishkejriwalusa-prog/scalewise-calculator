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

  return json(200, {
    configured: true,
    mode: 'preset_answers',
    reply: replyFor(message),
    responseId: null,
  }, headers);
};

function replyFor(question) {
  const s = String(question || '').toLowerCase();

  if ((s.includes('what') && s.includes('scalewise')) || s.includes('services')) {
    return 'ScaleWise supports bookkeeping, reconciliations, AP/AR, reporting preparation, tax-ready workflows, finance operations, FP&A, and offshore support for CPA firms and growing businesses.';
  }

  if (s.includes('price') || s.includes('pricing') || s.includes('cost') || s.includes('charge')) {
    return 'Pricing depends on transaction volume, number of entities, reporting needs, tax-readiness, and the level of advisory support required. For a formal quote, the ScaleWise team can review your scope directly.';
  }

  if (s.includes('cpa') || s.includes('accounting firm')) {
    return 'Yes. ScaleWise can support CPA firms with white-label bookkeeping, cleanup projects, reconciliations, reporting preparation, and seasonal capacity support.';
  }

  if (s.includes('restaurant') || s.includes('food') || s.includes('operator')) {
    return 'Yes. Restaurant bookkeeping often needs careful tracking of daily sales, delivery-app payouts, tips, payroll coordination, vendor invoices, and cash reconciliation. ScaleWise can help structure that workflow.';
  }

  if (s.includes('tax')) {
    return 'ScaleWise can support tax-ready workflows through organized books, reconciled accounts, supporting schedules, and year-end cleanup. Formal tax positions or filings should be confirmed with the responsible tax professional.';
  }

  if (s.includes('proposal') || s.includes('contract') || s.includes('quote') || s.includes('sensitive')) {
    return 'For proposals, contracts, confidential matters, or account-specific questions, please contact the ScaleWise team at info@scalewise.group.';
  }

  if (s.includes('contact') || s.includes('call') || s.includes('email') || s.includes('book')) {
    return 'You can contact ScaleWise at info@scalewise.group or +1 307 285 0020.';
  }

  if (s === 'hi' || s === 'hello' || s === 'hey' || s.includes('good morning') || s.includes('good afternoon')) {
    return 'Hello! Welcome to ScaleWise. I can help with our services, pricing approach, CPA firm support, restaurant bookkeeping, and contact details.';
  }

  return 'Thanks for your question. ScaleWise can help with finance operations, bookkeeping, reporting, tax-ready workflows, and offshore support. For a tailored answer, please contact info@scalewise.group.';
}

function json(statusCode, body, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}
