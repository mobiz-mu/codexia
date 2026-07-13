import { createClient } from "@/lib/supabase/server";

export type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  swift: string;
};

export async function getBankDetails(): Promise<BankDetails> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["bank_name", "bank_account_name", "bank_account_number", "bank_swift"]);

  const rows = Object.fromEntries((data ?? []).map((row) => [row.key, row.value as string]));

  return {
    bankName: rows.bank_name ?? "",
    accountName: rows.bank_account_name ?? "",
    accountNumber: rows.bank_account_number ?? "",
    swift: rows.bank_swift ?? "",
  };
}
