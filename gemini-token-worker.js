// Cloudflare Worker: deploy this file, then add GEMINI_API_KEY as an encrypted Secret.
// It returns a short-lived Gemini Live token; it never exposes your long-lived API key.
const cors = {
  'Access-Control-Allow-Origin': 'https://YOUR_GITHUB_USERNAME.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/token') {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: cors });
    }

    const now = Date.now();
    const body = {
      uses: 1,
      expireTime: new Date(now + 10 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: 'models/gemini-3.1-flash-live-preview',
      },
    };

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'x-goog-api-key': env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Token creation failed' }), {
        status: response.status, headers: cors,
      });
    }
    return new Response(JSON.stringify({ token: data.name, expiresAt: data.expireTime }), { headers: cors });
  },
};
