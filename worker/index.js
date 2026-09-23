import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/analyze') {
      if (request.method === 'OPTIONS') return corsResponse();
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

      try {
        const { text } = await request.json();
        if (!text || text.trim().length === 0) {
          return jsonResponse({ error: 'No text provided' }, 400);
        }
        return await streamAnalysis(text, env.NVIDIA_API_KEY);
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
      );
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  },
};

async function streamAnalysis(text, apiKey) {
  const system = `You review hospital admission documents for patient advocates. Find every clause in the document that waives or limits a patient's rights, such as:
- arbitration agreements or waivers of the right to sue or join a class action
- limits on the hospital's liability for negligence or malpractice
- broad consent to share or release medical information
- waivers of statutory patient rights
- financial assignments or guarantees that take away patient protections

Reply with ONLY a JSON array, no other text. Each element is an object with these keys:
"quote": the clause copied word-for-word from the document
"right": short name of the right being waived or limited
"explanation": one or two plain-English sentences on what the patient gives up
"risk": "high", "medium", or "low"

Every quote must be real text from the document. If nothing qualifies, reply with [].`;

  const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Document:\n\n${text.slice(0, 6000)}` },
      ],
      max_tokens: 2048,
      temperature: 0.1,
      stream: true,
    }),
  });

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
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) fullText += delta;
          } catch {}
        }
      }

      await writer.write(encoder.encode(JSON.stringify(parseClauses(fullText))));
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

function parseClauses(raw) {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) {
    return { error: 'The AI did not return a readable answer. Please try again.' };
  }

  let items;
  try {
    items = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { error: 'The AI did not return a readable answer. Please try again.' };
  }

  const isPlaceholder = (s) => /^\s*\[.*\]\s*$/.test(s);
  const clauses = (Array.isArray(items) ? items : [])
    .map((c) => ({
      quote: String(c?.quote ?? '').trim(),
      right: String(c?.right ?? '').trim(),
      explanation: String(c?.explanation ?? '').trim(),
      risk: String(c?.risk ?? '').trim().toLowerCase(),
    }))
    .filter((c) => c.right && c.explanation && !isPlaceholder(c.right) && !isPlaceholder(c.explanation));

  return { clauses };
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
