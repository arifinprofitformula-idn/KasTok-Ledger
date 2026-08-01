export const idMonths = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function fmt(value: number) {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

export function fmtSigned(value: number) {
  return (value < 0 ? "-Rp " : "Rp ") + Math.abs(Math.round(value)).toLocaleString("id-ID");
}

export function fmtShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${Math.round(value / 100_000_000) / 10}M`;
  if (abs >= 1_000_000) return `${Math.round(value / 100_000) / 10}Jt`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}Rb`;
  return String(Math.round(value));
}

export function monthLabel(key: string | null) {
  if (!key || key === "Tidak diketahui") return "Tidak diketahui";
  const [year, month] = key.split("-");
  return `${idMonths[Number(month) - 1]} ${year}`;
}
