// AI description generation.
//
// SECURITY: Never call third-party AI APIs directly from the browser — that
// exposes the API key to every visitor via DevTools → Network. Instead, route
// requests through a backend endpoint (e.g. /api/ai/describe) that keeps the
// key server-side.
//
// The previous implementation embedded VITE_ANTHROPIC_API_KEY in the client
// bundle. That key has been removed. To re-enable AI descriptions:
//   1. Add a backend route that proxies to the Anthropic API.
//   2. Update this function to call YOUR backend, not Anthropic directly.

export async function generateDescription(
  name: string,
  category: string
): Promise<string> {
  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error(
      "AI description generation is disabled. Set VITE_AI_PROXY_URL to a " +
        "backend endpoint that proxies Anthropic requests (never expose API keys in the browser)."
    );
  }

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, category }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as any)?.error?.message || `AI proxy error ${response.status}`
    );
  }

  const data = await response.json();
  const text: string = data?.description ?? data?.content?.[0]?.text ?? "";
  return text.trim();
}
