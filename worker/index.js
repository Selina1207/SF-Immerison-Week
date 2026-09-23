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
  const prompt = `You are a legal analyst helping hospital patient advocates identify clauses in hospital admission documents that waive or limit patient rights.

Analyze the following hospital admission document and identify ALL clauses that waive or limit patient rights, including:
- Arbitration agreements or waivers of the right to sue
- Liability limitations for negligence or malpractice
- Broad consent to data sharing or release of medical information without restriction
- Waivers of specific statutory patient rights
- Assignment of financial benefits or obligations that affect patient rights

For each clause found, respond using EXACTLY this format (repeat for each clause):

CLAUSE: [exact text or key excerpt from the document]
RIGHT AFFECTED: [the specific right being waived or limited]
PLAIN ENGLISH: [1-2 sentence explanation a non-lawyer can understand]
RISK LEVEL: [High / Medium / Low]
---

If no rights-waiver clauses are found, say: "No rights-waiver clauses identified."

Document text:
${text.slice(0, 6000)}`;

  const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
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

      await writer.write(encoder.encode(JSON.stringify({ analysis: fullText })));
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
