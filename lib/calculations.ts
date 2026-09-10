import type { DateFilter, Granularity, Summary, Transaction } from "@/lib/types";
import { idMonths } from "@/lib/format";

export function isoWeekInfo(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function periodKey(transaction: Transaction, granularity: Granularity) {
  if (granularity === "month") return transaction.month_key || "Tidak diketahui";
  const parts = transaction.date_raw.split("/").map(Number);
  const [year, month, day] = parts;
  if (!year || !month || !day) return "Tidak diketahui";
  if (granularity === "day") return transaction.date_raw.replace(/\//g, "-");
  const week = isoWeekInfo(year, month, day);
  return `${week.year}-W${String(week.week).padStart(2, "0")}`;
}

function shortDate(dateRaw: string) {
  const [year, month, day] = dateRaw.split("/").map(Number);
  if (!year || !month || !day) return dateRaw;
  return `${day} ${idMonths[month - 1]}`;
}

export function periodLabel(key: string, granularity: Granularity, list: Transaction[]) {
  if (granularity === "month") {
    if (key === "Tidak diketahui") return key;
    const [year, month] = key.split("-");
    return `${idMonths[Number(month) - 1]} ${year}`;
  }

  if (granularity === "day") {
    const [year, month, day] = key.split("-").map(Number);
    if (!year || !month || !day) return key;
    return `${day} ${idMonths[month - 1]} ${year}`;
  }

  const dates = list.map((item) => item.date_raw).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? shortDate(first) : `${shortDate(first)}-${shortDate(last)}`;
}

export function granName(granularity: Granularity) {
  if (granularity === "day") return "Harian";
  if (granularity === "week") return "Mingguan";
  return "Bulanan";
}

export function summarize(list: Transaction[]): Summary {
  let withdrawal = 0;
  let gmv = 0;
  let earnings = 0;

  list.forEach((item) => {
    const abs = Math.abs(Number(item.amount));
    if (item.type === "Withdrawal") withdrawal += abs;
    if (item.type === "GMV Pay Deduction") gmv += abs;
    if (item.type === "Earnings") earnings += abs;
  });

  return { withdrawal, gmv, earnings, gross: withdrawal - gmv };
}

export function groupByPeriod(granularity: Granularity, list: Transaction[]) {
  return list.reduce<Record<string, Transaction[]>>((acc, item) => {
    const key = periodKey(item, granularity);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function applyDateFilter(list: Transaction[], filter: DateFilter) {
  if (!filter.from && !filter.to) return list;
  return list.filter((item) => {
    if (!item.transaction_date) return false;
    if (filter.from && item.transaction_date < filter.from) return false;
    if (filter.to && item.transaction_date > filter.to) return false;
    return true;
  });
}

export function availableMonths(list: Transaction[]) {
  return Array.from(new Set(list.map((item) => item.month_key).filter(Boolean) as string[])).sort().reverse();
}
