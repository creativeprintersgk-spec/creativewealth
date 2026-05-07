import { getLedgerWithBalance } from "./logic";

export default function LedgerTable({ ledger }: { ledger: string }) {
  const result = getLedgerWithBalance(ledger);
  const data = Array.isArray(result) ? [] : result.transactions;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">
          {ledger} Ledger
        </h2>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Type</th>
                <th className="text-right py-2">Debit</th>
                <th className="text-right py-2">Credit</th>
                <th className="text-right py-2">Balance</th>
              </tr>
            </thead>

            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground opacity-50 italic">
                    No entries for {ledger} yet.
                  </td>
                </tr>
              ) : data.map((row: any, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-2">{row.date}</td>
                  <td className="capitalize">{row.voucherType}</td>

                  <td className="text-right text-gain">
                    {row.debit > 0 ? row.debit.toLocaleString() : ""}
                  </td>

                  <td className="text-right text-loss">
                    {row.credit > 0 ? row.credit.toLocaleString() : ""}
                  </td>

                  <td className="text-right font-medium">
                    <div className="text-bold">
                      {Math.abs(row.balance).toLocaleString()}
                    </div>
                    <div className="text-muted" style={{ marginTop: "2px", fontSize: "11px", color: "hsl(220, 9%, 60%)" }}>
                      {row.balance >= 0 ? "Dr" : <span style={{ color: "hsl(0, 84%, 55%)", fontWeight: 600 }}>Cr (Overdrawn)</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
