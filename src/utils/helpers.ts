import jwt from 'jsonwebtoken';

export const generateToken = (
  payload: { userId: number; email: string; role: string },
  expiresIn?: string
): string => {
  const options: jwt.SignOptions = {
    expiresIn: (expiresIn || process.env.JWT_EXPIRES_IN || '7d') as any,
  };
  return jwt.sign(payload, process.env.JWT_SECRET as string, options);
};

export const generateReference = (prefix: string): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}${month}${day}-${random}`;
};

export const generateWalletAddress = (currency: string, network?: string): string => {
  const addresses: Record<string, string> = {
    'BTC': process.env.WALLET_BTC || 'bc1q8waqj9qurtpu07q0v826qr60n7jyxw247q8xes',
    'ETH': process.env.WALLET_ETH || '0x5D1Dea66d22BdA4Bd0C8737CC236A76334326056',
    'SOL': process.env.WALLET_SOL || 'HjWcM41m6aYwZVAESCFrk1EAhqHP6MV9h5pRRtnCmT5m',
    'USDT-ERC20': process.env.WALLET_USDT_ERC20 || '0x5d1dea66d22bda4bd0c8737cc236a76334326056',
    'USDC-ERC20': process.env.WALLET_USDC_ERC20 || '0x5D1Dea66d22BdA4Bd0C8737CC236A76334326056',
  };

  if (currency === 'USDT' || currency === 'USDC') {
    return addresses[`${currency}-${network || 'ERC20'}`] || addresses['USDT-ERC20'];
  }

  return addresses[currency] || addresses['ETH'];
};

export const formatCurrency = (amount: number | string, currency: string = 'USD'): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const calculatePercentage = (part: number | string, total: number | string): number => {
  const p = typeof part === 'string' ? parseFloat(part) : part;
  const t = typeof total === 'string' ? parseFloat(total) : total;
  if (t === 0) return 0;
  return parseFloat(((p / t) * 100).toFixed(2));
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

export const differenceInDays = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};
