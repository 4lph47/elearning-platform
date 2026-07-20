import type { SpreadsheetPreview } from "@/lib/spreadsheetPreview";

export function SpreadsheetPreviewViewer({ preview }: { preview: SpreadsheetPreview }) {
  return (
    <div className="h-full w-full overflow-auto bg-slate-950 p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {preview.headers.map((h) => (
              <th key={h} className="border border-white/10 bg-slate-900 px-3 py-2 text-left font-semibold text-slate-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-white/10 px-3 py-2 text-slate-300">
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
