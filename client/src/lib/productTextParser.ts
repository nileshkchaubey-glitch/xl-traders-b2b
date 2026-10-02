// Local extraction only. No provider, network, credential or generated claims.
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

export function parseProductText(
  text: string,
  categories: string[]
): ParsedProduct {
  const result: ParsedProduct = {};
  const cleanText = text.trim();
  const lines = cleanText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return {};

  // 1. Extract Name (Usually the first line, up to 10 words)
  const firstLine = lines[0];
  result.name = firstLine.split(/\s+/).slice(0, 10).join(" ");

  // 2. Extract Price (Look for Price, Rate, Rs., ₹, @ followed by a number)
  const priceRegex =
    /(?:price|rate|rs\.?|₹|@|rate\s*of)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i;
  const priceMatch = cleanText.match(priceRegex);
  if (priceMatch) {
    result.price = parseFloat(priceMatch[1]);
  }

  // 3. Extract MRP (Look for MRP, list price followed by a number)
  const mrpRegex =
    /(?:mrp|list\s*price|m\.r\.p\.?)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i;
  const mrpMatch = cleanText.match(mrpRegex);
  if (mrpMatch) {
    result.mrp = parseFloat(mrpMatch[1]);
  }

  // 4. Extract Unit of Measure
  const unitMapping: Record<string, string> = {
    pcs: "pcs",
    piece: "pcs",
    pieces: "pcs",
    pc: "pcs",
    box: "box",
    boxes: "box",
    pack: "pack",
    packet: "pack",
    packets: "pack",
    pkt: "pack",
    pkts: "pack",
    pkg: "pack",
    roll: "roll",
    rolls: "roll",
    kg: "kg",
    kilo: "kg",
    kilogram: "kg",
    litre: "litre",
    liter: "litre",
    ltr: "litre",
    ml: "litre",
    set: "set",
    sets: "set",
  };

  const words = cleanText.toLowerCase().split(/[\s,()\[\]:;]+/);
  for (const word of words) {
    if (unitMapping[word]) {
      result.unit_of_measure = unitMapping[word];
      break;
    }
  }

  // 5. Extract Quantity in Unit
  // Look for "pack of 100", "box of 250", "100 pcs", "50 pieces", etc.
  const qtyRegex =
    /(?:pack|box|qty|quantity|size)?\s*(?:of|in)?\s*(\d+)\s*(?:pcs|pieces|units|qty|box|pack|rolls|pieces|pkt|set)/i;
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
  const brandRegex =
    /(?:brand|mfg|manufacturer)\s*[:=-]\s*([a-zA-Z0-9\s]+)(?:\n|,|$)/i;
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
  const remainingText = lines.slice(1).join(" ").trim();
  if (remainingText) {
    result.description =
      remainingText.slice(0, 150) + (remainingText.length > 150 ? "..." : "");
  }

  return result;
}
