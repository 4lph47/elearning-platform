export function timeAgo(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));

  const units: [number, string, string][] = [
    [60, "segundo", "segundos"],
    [60, "minuto", "minutos"],
    [24, "hora", "horas"],
    [30, "dia", "dias"],
    [12, "mês", "meses"],
    [Number.POSITIVE_INFINITY, "ano", "anos"],
  ];

  let value = seconds;
  for (const [amount, singular, plural] of units) {
    if (value < amount) {
      const rounded = Math.floor(value);
      if (rounded <= 1 && singular !== "segundo") return `há 1 ${singular}`;
      if (rounded < 1) return "agora mesmo";
      return `há ${rounded} ${rounded === 1 ? singular : plural}`;
    }
    value = value / amount;
  }
  return "há muito tempo";
}
