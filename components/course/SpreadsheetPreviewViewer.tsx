import type { SpreadsheetPreview } from "@/lib/spreadsheetPreview";

export function SpreadsheetPreviewViewer({ preview }: { preview: SpreadsheetPreview }) {
  return (
    <div className="h-full w-full overflow-auto bg-white p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {preview.headers.map((h) => (
              <th key={h} className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-slate-200 px-3 py-2 text-slate-600">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
