const fs = require('fs');
let c = fs.readFileSync('src/components/pms/HoldingBreakupModal.tsx', 'utf8');

// Insert totals calculation
const target1 = `  if (!open || !holding) return null;

  return (`;

const rep1 = `  if (!open || !holding) return null;

  const totalQty = holding.portfolioSplits?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;
  const totalInvested = holding.portfolioSplits?.reduce((acc, item) => acc + (item.amtInvested || 0), 0) || 0;
  const totalCurrentValue = holding.portfolioSplits?.reduce((acc, item) => acc + ((item.quantity || 0) * holding.currentPrice), 0) || 0;

  return (`;

c = c.replace(target1, rep1);

// Insert tfoot
const target2 = `              ))}
            </tbody>
          </table>`;

const rep2 = `              ))}
            </tbody>
            <tfoot style={{ backgroundColor: '#f1f5f9', fontWeight: 600, borderTop: '2px solid #cbd5e1' }}>
              <tr>
                <td colSpan={2} style={{ padding: '12px 16px', textAlign: 'center', color: '#475569' }}>
                  Totals
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0f172a' }}>
                  {totalQty.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0f172a' }}>
                  Rs. {totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0f172a' }}>
                  Rs. {totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>`;

c = c.replace(target2, rep2);

fs.writeFileSync('src/components/pms/HoldingBreakupModal.tsx', c);
console.log('Patched HoldingBreakupModal');
