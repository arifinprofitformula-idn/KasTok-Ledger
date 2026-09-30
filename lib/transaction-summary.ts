import type { Summary, Transaction } from "@/lib/types";

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

  return { withdrawal, gmv, earnings, gross: withdrawal };
}
