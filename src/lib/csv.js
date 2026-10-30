/**
 * csv.js — RFC-4180 compliant CSV parse, stringify, and download helpers.
 */

/**
 * Parse a CSV string into an array of row arrays.
 * Handles quoted fields, embedded commas, and embedded newlines.
 * The first row is treated as a header row.
 * Returns an array of objects keyed by header names.
 * @param {string} text - Raw CSV text
 * @returns {Object[]}
 */
export function csvParse(text) {
  if (!text || !text.trim()) return [];

  const rows = [];
  const len = text.length;
  let i = 0;

  function parseField() {
    if (i < len && text[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += text[i++];
        }
      }
      return field;
    } else {
      // Unquoted field
      let field = '';
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i++];
      }
      return field;
    }
  }

  function parseRow() {
    const row = [];
    while (i < len && text[i] !== '\n' && text[i] !== '\r') {
      row.push(parseField());
      if (i < len && text[i] === ',') i++;
    }
    // consume \r\n or \n
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;
    return row;
  }

  // Parse header row
  const headers = parseRow();
  if (headers.length === 0) return [];

  // Parse data rows
  while (i < len) {
    // Skip blank lines
    if (text[i] === '\r' || text[i] === '\n') {
      if (text[i] === '\r') i++;
      if (i < len && text[i] === '\n') i++;
      continue;
    }
    const row = parseRow();
    if (row.length === 0) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * Serialize an array of objects (or array of arrays) to a CSV string.
 * If objects are given, the keys of the first row become the header.
 * All values are quoted.
 * @param {Object[]|string[][]} rows
 * @returns {string}
 */
export function csvStringify(rows) {
  if (!rows || rows.length === 0) return '';

  function escapeField(val) {
    const s = val === null || val === undefined ? '' : String(val);
    // Always quote; escape internal quotes by doubling
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function rowToLine(cells) {
    return cells.map(escapeField).join(',');
  }

  // Detect if rows are arrays or objects
  if (Array.isArray(rows[0])) {
    return rows.map(rowToLine).join('\r\n') + '\r\n';
  }

  const headers = Object.keys(rows[0]);
  const lines = [rowToLine(headers)];
  for (const obj of rows) {
    lines.push(rowToLine(headers.map((h) => obj[h])));
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Trigger a CSV file download in the browser.
 * @param {string} filename - e.g. 'report.csv'
 * @param {string} text - CSV content
 */
export function csvDownload(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
