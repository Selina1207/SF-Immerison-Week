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
        const analysis = await analyzeDocument(text, env.NVIDIA_API_KEY);
        return jsonResponse({ analysis });
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

async function analyzeDocument(text, apiKey) {
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
${text.slice(0, 12000)}`;

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-ai/deepseek-v4.1-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
