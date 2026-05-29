export function formatMoney(value, currency = 'USD') {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function accountTitle(type) {
  return (
    {
      checking: 'Checking',
      savings: 'High-Yield Savings',
      money_market: 'Money Market',
      investment: 'Investment',
      cd: 'CD',
    }[type] || type
  );
}
