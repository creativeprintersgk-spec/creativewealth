export interface FnoContract {
  underlying: string;
  expiryDate: string; // e.g. '28-MAR-2024'
  strikePrice: number | null;
  optionType: 'CE' | 'PE' | 'FUT' | null;
  lotSize?: number; // Usually resolved from a master list, but optional here
}

/**
 * Parses standard Indian F&O symbols.
 * Examples:
 * - "NIFTY 28MAR24 22000 CE"
 * - "RELIANCE 25APR2024 2900 PE"
 * - "HDFCBANK 30MAY2024 FUT"
 * - "NIFTY24MAR22000CE" (Compressed format sometimes used by brokers)
 */
export function parseFnoSymbol(rawSymbol: string): FnoContract | null {
  const symbol = rawSymbol.trim().toUpperCase();

  // 1. Spaced format: NIFTY 28MAR2024 22000 CE or NIFTY 28MAR24 FUT
  const spacedRegex = /^([A-Z0-9\-&]+)\s+(\d{1,2}[A-Z]{3}(?:\d{2}|\d{4}))\s*(?:(\d+(?:\.\d+)?)\s*)?(CE|PE|FUT)$/;
  const matchSpaced = symbol.match(spacedRegex);

  if (matchSpaced) {
    return {
      underlying: matchSpaced[1],
      expiryDate: matchSpaced[2],
      strikePrice: matchSpaced[3] ? parseFloat(matchSpaced[3]) : null,
      optionType: matchSpaced[4] as 'CE' | 'PE' | 'FUT',
    };
  }

  // 2. Compressed format: NIFTY24MAR22000CE or NIFTY24MARFUT
  // Format: [UNDERLYING][YY][MMM][STRIKE][CE/PE] or [UNDERLYING][YY][MMM]FUT
  const compressedRegex = /^([A-Z0-9\-&]+)(\d{2})([A-Z]{3})(?:(\d+(?:\.\d+)?)(CE|PE)|FUT)$/;
  const matchComp = symbol.match(compressedRegex);

  if (matchComp) {
    const isFut = symbol.endsWith('FUT');
    const optionType = isFut ? 'FUT' : matchComp[5] as 'CE' | 'PE';
    const strike = isFut ? null : parseFloat(matchComp[4]);
    return {
      underlying: matchComp[1],
      expiryDate: `20${matchComp[2]}${matchComp[3]}`, // Converts 24MAR to 2024MAR (Rough approximation for expiry string)
      strikePrice: strike,
      optionType
    };
  }

  return null;
}
