/**
 * Google Sheets CSV import utility.
 *
 * Supports:
 *   - Spreadsheet ID only:  1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
 *   - Edit / view URL:      https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
 *   - Published CSV URL:    https://docs.google.com/spreadsheets/d/{ID}/pub?...output=csv
 *
 * The sheet must be shared publicly ("Anyone with the link can view") or
 * published to the web (File → Share → Publish to web → CSV).
 */

export interface ParsedSheetRef {
  spreadsheetId: string;
  gid?: string;
}

export function parseSheetInput(input: string): ParsedSheetRef | null {
  const trimmed = input.trim();

  // Raw spreadsheet ID (alphanumeric + dashes/underscores, 20+ chars, no slashes)
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return { spreadsheetId: trimmed };
  }

  // Extract ID from any Google Sheets URL
  const idMatch = trimmed.match(/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!idMatch) return null;

  const spreadsheetId = idMatch[1];

  // Try to extract sheet tab gid from URL params or hash
  const gidMatch =
    trimmed.match(/[?&]gid=(\d+)/) || trimmed.match(/#gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : undefined;

  return { spreadsheetId, gid };
}

export function buildCsvExportUrl(ref: ParsedSheetRef): string {
  const base = `https://docs.google.com/spreadsheets/d/${ref.spreadsheetId}/export?format=csv`;
  return ref.gid ? `${base}&gid=${ref.gid}` : base;
}

export async function fetchGoogleSheetAsCsv(input: string): Promise<string> {
  const ref = parseSheetInput(input);
  if (!ref) {
    throw new Error(
      "Could not parse the Google Sheets URL or ID. Please paste the full URL or just the spreadsheet ID."
    );
  }

  const csvUrl = buildCsvExportUrl(ref);

  let response: Response;
  try {
    response = await fetch(csvUrl);
  } catch {
    throw new Error(
      "Network error fetching the sheet. Make sure the sheet is shared publicly."
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Access denied. Please share the sheet with "Anyone with the link can view" or publish it to the web (File → Share → Publish to web).'
      );
    }
    throw new Error(
      `Google returned an error (${response.status}). Is the spreadsheet public?`
    );
  }

  const text = await response.text();

  // Verify we got CSV and not an HTML error page
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(
      "The sheet is not publicly accessible. Open the sheet, go to File → Share → Publish to web, select CSV format, then paste that URL here."
    );
  }

  return text;
}
