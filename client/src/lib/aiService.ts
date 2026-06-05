const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function generateDescription(name: string, category: string): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not configured');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
            `Write a 2-sentence B2B wholesale product description for XL Traders packaging business, Surat. ` +
            `Product: ${name}, Category: ${category}. Focus on material, pack size, use case.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `Anthropic API error ${response.status}`);
  }

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '';
  return text.trim();
}
