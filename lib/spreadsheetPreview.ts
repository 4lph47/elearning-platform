export interface SpreadsheetPreview {
  headers: string[];
  rows: (string | number)[][];
}

export function buildSpreadsheetPreview(resourceName: string): SpreadsheetPreview {
  const topic = resourceName.replace(/\.(xlsx|xls)$/i, "").trim();

  return {
    headers: ["Item", "Valor", "Notas"],
    rows: [
      [`${topic} - linha 1`, 100, "Exemplo"],
      [`${topic} - linha 2`, 200, "Exemplo"],
      [`${topic} - linha 3`, 300, "Exemplo"],
    ],
  };
}
