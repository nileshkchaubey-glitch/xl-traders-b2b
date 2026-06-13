const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export interface ParsedProduct {
  name?: string;
  price?: number;
  mrp?: number;
  unit_of_measure?: string;
  quantity_in_unit?: number;
  brand?: string;
  category_name?: string;
  description?: string;
}

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

/**
 * Parses unstructured text (e.g. from copy-pasting a product page, PDF, or supplier detail)
 * into a structured product object. If the Anthropic API key is not configured, it falls back
 * to a local Regex Heuristic parser.
 */
export async function parseProductDetailsWithAI(text: string, categories: string[]): Promise<ParsedProduct> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content:
                `You are a B2B product data extraction tool. Extract structured data from this unstructured text (copied from a website, PDF, or WhatsApp message). ` +
                `Available categories: [${categories.join(', ')}]. \n\n` +
                `Return ONLY a raw JSON object (do not wrap in markdown \`\`\`json blocks) with these fields: \n` +
                `- name: product name (clean, title case, eg. "10x10 Round Plastic Container") \n` +
                `- price: wholesale price per unit/pack, as a number. Extract numeric value from expressions like Rs.250 or ₹250. \n` +
                `- mrp: retail price (MRP), as a number. \n` +
                `- unit_of_measure: must be exactly one of: pcs, box, pack, roll, kg, litre, set. Map terms like "pieces", "packet", "packet", "pkt", "roll" to the correct unit. \n` +
                `- quantity_in_unit: number of items inside the pack/box (eg. if "box of 250 pcs", set quantity_in_unit to 250). \n` +
                `- brand: product brand if specified, or blank. \n` +
                `- category_name: select the most matching category from the available list, or suggest a new category name. \n` +
                `- description: a short 2-sentence description summarizing this product. \n\n` +
                `Text to parse:\n"""\n${text}\n"""`
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText: string = data?.content?.[0]?.text ?? '{}';
        
        // Clean JSON formatting (remove markdown code fences if Claude added them anyway)
        const cleanJson = responseText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        
        const parsed = JSON.parse(cleanJson);
        return {
          name: parsed.name || undefined,
          price: parsed.price ? parseFloat(parsed.price) : undefined,
          mrp: parsed.mrp ? parseFloat(parsed.mrp) : undefined,
          unit_of_measure: parsed.unit_of_measure || undefined,
          quantity_in_unit: parsed.quantity_in_unit ? parseInt(parsed.quantity_in_unit) : undefined,
          brand: parsed.brand || undefined,
          category_name: parsed.category_name || undefined,
          description: parsed.description || undefined
        };
      }
    } catch (err) {
      console.warn('AI Parsing failed, falling back to heuristic parsing:', err);
    }
  }

  // Fallback heuristic parsing (Regex-based)
  return parseProductDetailsHeuristically(text, categories);
}

function parseProductDetailsHeuristically(text: string, categories: string[]): ParsedProduct {
  const result: ParsedProduct = {};
  const cleanText = text.trim();
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) return {};

  // 1. Extract Name (Usually the first line, up to 10 words)
  const firstLine = lines[0];
  result.name = firstLine.split(/\s+/).slice(0, 10).join(' ');

  // 2. Extract Price (Look for Price, Rate, Rs., ₹, @ followed by a number)
  const priceRegex = /(?:price|rate|rs\.?|₹|@|rate\s*of)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i;
  const priceMatch = cleanText.match(priceRegex);
  if (priceMatch) {
    result.price = parseFloat(priceMatch[1]);
  }

  // 3. Extract MRP (Look for MRP, list price followed by a number)
  const mrpRegex = /(?:mrp|list\s*price|m\.r\.p\.?)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i;
  const mrpMatch = cleanText.match(mrpRegex);
  if (mrpMatch) {
    result.mrp = parseFloat(mrpMatch[1]);
  }

  // 4. Extract Unit of Measure
  const unitMapping: Record<string, string> = {
    pcs: 'pcs', piece: 'pcs', pieces: 'pcs', pc: 'pcs',
    box: 'box', boxes: 'box',
    pack: 'pack', packet: 'pack', packets: 'pack', pkt: 'pack', pkts: 'pack', pkg: 'pack',
    roll: 'roll', rolls: 'roll',
    kg: 'kg', kilo: 'kg', kilogram: 'kg',
    litre: 'litre', liter: 'litre', ltr: 'litre', ml: 'litre',
    set: 'set', sets: 'set'
  };

  const words = cleanText.toLowerCase().split(/[\s,()\[\]:;]+/);
  for (const word of words) {
    if (unitMapping[word]) {
      result.unit_of_measure = unitMapping[word];
      break;
    }
  }

  // Default unit to 'pcs' if not found
  if (!result.unit_of_measure) {
    result.unit_of_measure = 'pcs';
  }

  // 5. Extract Quantity in Unit
  // Look for "pack of 100", "box of 250", "100 pcs", "50 pieces", etc.
  const qtyRegex = /(?:pack|box|qty|quantity|size)?\s*(?:of|in)?\s*(\d+)\s*(?:pcs|pieces|units|qty|box|pack|rolls|pieces|pkt|set)/i;
  const qtyMatch = cleanText.match(qtyRegex);
  if (qtyMatch) {
    result.quantity_in_unit = parseInt(qtyMatch[1]);
  } else {
    // Look for standalone "pack/box of 50"
    const qtyRegexAlt = /(?:pack|box|qty|quantity)\s*(?:of|in)?\s*(\d+)/i;
    const qtyMatchAlt = cleanText.match(qtyRegexAlt);
    if (qtyMatchAlt) {
      result.quantity_in_unit = parseInt(qtyMatchAlt[1]);
    }
  }

  // 6. Extract Brand (Look for Brand: BrandName, Manufacturer: BrandName)
  const brandRegex = /(?:brand|mfg|manufacturer)\s*[:=-]\s*([a-zA-Z0-9\s]+)(?:\n|,|$)/i;
  const brandMatch = cleanText.match(brandRegex);
  if (brandMatch) {
    result.brand = brandMatch[1].trim();
  }

  // 7. Match Category
  // Try to find if any of the existing categories is present in the text
  const matchedCategory = categories.find(cat => 
    cleanText.toLowerCase().includes(cat.toLowerCase())
  );
  if (matchedCategory) {
    result.category_name = matchedCategory;
  }

  // 8. Description (Clean text, remove first line if name, truncate)
  const remainingText = lines.slice(1).join(' ').trim();
  if (remainingText) {
    result.description = remainingText.slice(0, 150) + (remainingText.length > 150 ? '...' : '');
  } else {
    result.description = `Wholesale ${result.name} B2B packaging supplier.`;
  }

  return result;
}
