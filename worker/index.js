export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/analyze') {
      if (request.method === 'OPTIONS') return corsResponse();
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

      try {
        const { text, documentName } = await request.json();
        if (!text || text.trim().length === 0) {
          return jsonResponse({ error: 'No text provided' }, 400);
        }
        const name = String(documentName || '').trim() || 'untitled.pdf';
        return await streamAnalysis(text.slice(0, 6000), name, env);
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

async function streamAnalysis(text, documentName, env) {
  const system = `You review hospital admission documents for patient advocates. Find every clause in the document that waives or limits a patient's rights, such as:
- arbitration agreements or waivers of the right to sue or join a class action
- limits on the hospital's liability for negligence or malpractice
- broad consent to share or release medical information
- waivers of statutory patient rights
- financial assignments or guarantees that take away patient protections

Reply with ONLY a JSON array, no other text. Each element is an object with these keys:
"quote": the key sentence copied word-for-word from the document, at most 40 words
"right": short name of the right being waived or limited
"explanation": one plain-English sentence on what the patient gives up
"risk": "high", "medium", or "low"

Every quote must be real text from the document. If nothing qualifies, reply with [].
/no_think`;

  const request = {
    model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Document:\n\n${text}` },
    ],
    max_tokens: 4096,
    temperature: 0.1,
    stream: true,
    chat_template_kwargs: { enable_thinking: false },
  };

  const callNvidia = (body) =>
    fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  const startedAt = Date.now();
  let upstream = await callNvidia(request);
  // Not every NVIDIA model accepts chat_template_kwargs; retry once without it.
  if (upstream.status === 400 || upstream.status === 422) {
    console.error('NVIDIA rejected chat_template_kwargs, retrying without it', await upstream.text());
    const { chat_template_kwargs, ...plain } = request;
    upstream = await callNvidia(plain);
  }

  if (!upstream.ok) {
    const err = await upstream.text();
    throw new Error(`NVIDIA API error ${upstream.status}: ${err}`);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    const reader = upstream.body.getReader();
    let buffer = '';
    let fullText = '';
    let finishReason = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const choice = json.choices?.[0];
            if (choice?.delta?.content) fullText += choice.delta.content;
            if (choice?.finish_reason) finishReason = choice.finish_reason;
          } catch {}
        }
      }

      console.log('NVIDIA reply finished', {
        seconds: (Date.now() - startedAt) / 1000,
        characters: fullText.length,
        finishReason,
      });
      const result = parseClauses(fullText, finishReason);
      if (result.clauses) {
        result.saved = await saveAnalysis(env, documentName, text, fullText, result.clauses);
      }
      await writer.write(encoder.encode(JSON.stringify(result)));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function parseClauses(raw, finishReason) {
  const items = extractAnswerArray(raw);
  if (!items) {
    console.error('Unreadable AI reply', { finishReason, length: raw.length, tail: raw.slice(-1500) });
    const error =
      finishReason === 'length'
        ? 'The AI ran out of room before finishing. Try a shorter PDF.'
        : 'The AI did not return a readable answer. Please try again.';
    return { error, reply: raw.slice(-1500) };
  }

  const isPlaceholder = (s) => /^\s*\[.*\]\s*$/.test(s);
  const clauses = items
    .map((c) => ({
      quote: String(c?.quote ?? '').trim(),
      right: String(c?.right ?? '').trim(),
      explanation: String(c?.explanation ?? '').trim(),
      risk: normalizeRisk(c?.risk),
    }))
    .filter((c) => c.right && c.explanation && !isPlaceholder(c.right) && !isPlaceholder(c.explanation));

  return { clauses };
}

// The answer is the JSON array at the end of the reply; reasoning before it may contain stray brackets.
function extractAnswerArray(raw) {
  const thinkEnd = raw.lastIndexOf('</think>');
  const text = thinkEnd === -1 ? raw : raw.slice(thinkEnd + '</think>'.length);
  const end = text.lastIndexOf(']');
  if (end === -1) return null;

  for (let start = text.indexOf('['); start !== -1 && start < end; start = text.indexOf('[', start + 1)) {
    try {
      const value = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(value)) return value;
    } catch {}
  }
  return null;
}

function normalizeRisk(value) {
  const risk = String(value ?? '').trim().toLowerCase();
  return ['high', 'medium', 'low'].includes(risk) ? risk : 'medium';
}

async function saveAnalysis(env, documentName, text, aiResponse, clauses) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return false;

  const base = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1`;
  const headers = { apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys must not.
  if (env.SUPABASE_SERVICE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${env.SUPABASE_SERVICE_KEY}`;
  }

  try {
    const analysisRes = await fetch(`${base}/analyses`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ document_name: documentName, raw_text: text, ai_response: aiResponse }),
    });
    if (!analysisRes.ok) {
      console.error('Supabase analyses insert failed', analysisRes.status, await analysisRes.text());
      return false;
    }
    const [analysis] = await analysisRes.json();

    if (clauses.length === 0) return true;

    const clausesRes = await fetch(`${base}/clauses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        clauses.map((c) => ({
          analysis_id: analysis.id,
          right_affected: c.right,
          clause_text: c.quote || null,
          plain_english: c.explanation,
          risk_level: c.risk,
        }))
      ),
    });
    if (!clausesRes.ok) {
      console.error('Supabase clauses insert failed', clausesRes.status, await clausesRes.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase save failed', err);
    return false;
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function corsResponse() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
