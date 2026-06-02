const PRICE_LABELS = {
  premium: { label: '前方', keywords: ['前方', '優先', 'vip', 's'] },
  general: { label: '一般', keywords: ['一般', '通常'] },
  adv: { label: 'ADV', keywords: ['adv', '前売', '前売り'] },
  door: { label: '当日', keywords: ['当日', 'door'] },
};

function normalize(value) {
  return (value || '').normalize('NFKC').toLowerCase();
}

function toNumber(value) {
  return value == null || value === '' ? null : Number(String(value).replaceAll(',', ''));
}

function classifyPrice(label) {
  const normalized = normalize(label).replace(/\s/g, '');
  return Object.entries(PRICE_LABELS).find(([, data]) => data.keywords.some(keyword => normalized.includes(keyword)))?.[0];
}

export function parsePrices(text) {
  const prices = {};
  const matches = normalize(text).matchAll(/(?:^|[\s/／|｜、,，])([a-z]+|前方|優先|一般|通常|前売り?|当日)?\s*[¥￥]\s*([\d,]{3,})/gim);
  for (const match of matches) {
    const type = classifyPrice(match[1]) || 'general';
    if (prices[type] == null) prices[type] = toNumber(match[2]);
  }
  return prices;
}

export function mergePrices(detectedPrices, manualPrices) {
  return Object.fromEntries(
    Object.keys(PRICE_LABELS).map(type => [type, toNumber(manualPrices[type]) ?? detectedPrices[type] ?? null]),
  );
}

export function selectPrice(prices) {
  const type = ['general', 'adv', 'premium', 'door'].find(key => prices[key] != null);
  if (!type) return null;
  return { type, amount: prices[type], label: PRICE_LABELS[type].label };
}

export function listOtherPrices(prices, selectedType) {
  return Object.entries(prices)
    .filter(([type, amount]) => amount != null && type !== selectedType)
    .map(([type, amount]) => ({ type, amount, label: PRICE_LABELS[type].label }));
}
