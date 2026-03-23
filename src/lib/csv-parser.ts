/**
 * CSV Parser — handles quoted fields, commas inside quotes, and newlines inside quotes.
 * Returns an array of objects keyed by header names from the first row.
 */

export function parseCSV(text: string): Record<string, string>[] {
  const rows = tokenizeRows(text.trim());
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip empty rows
    if (row.length === 1 && row[0].trim() === '') continue;

    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (row[j] ?? '').trim();
    }
    results.push(obj);
  }

  return results;
}

function tokenizeRows(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        current.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        // Handle \r\n and bare \r
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i++;
        if (i < text.length && text[i] === '\n') i++;
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push last field and row
  current.push(field);
  if (current.length > 1 || current[0].trim() !== '') {
    rows.push(current);
  }

  return rows;
}
