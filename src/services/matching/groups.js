export function normalizeGroupName(value) {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　,，.．!！・_\-/／]+/g, '');
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function similarity(left, right) {
  if (!left || !right) return 0;
  return 1 - editDistance(left, right) / Math.max(left.length, right.length);
}

function bestWindowSimilarity(source, target) {
  if (!source || !target || source.length < target.length - 2) return 0;
  let best = 0;
  const minimumLength = Math.max(1, target.length - 2);
  const maximumLength = Math.min(source.length, target.length + 2);
  for (let length = minimumLength; length <= maximumLength; length += 1) {
    for (let index = 0; index <= source.length - length; index += 1) {
      best = Math.max(best, similarity(source.slice(index, index + length), target));
    }
  }
  return best;
}

function splitCandidateNames(value) {
  return (value || '')
    .split(/[\n\r|｜/／、;；]+/)
    .map(name => normalizeGroupName(name))
    .filter(Boolean);
}

function aliasMatch(sourceText, candidateNames, alias) {
  const normalizedAlias = normalizeGroupName(alias);
  const normalizedSource = normalizeGroupName(sourceText);
  if (!normalizedAlias) return null;
  if (normalizedSource.includes(normalizedAlias)) {
    return { confidence: 100, alias, matchType: 'alias' };
  }
  if (normalizedAlias.length < 5) return null;
  let bestConfidence = 0;
  candidateNames.forEach(candidate => {
    if (candidate.includes(normalizedAlias) || normalizedAlias.includes(candidate)) {
      bestConfidence = Math.max(bestConfidence, 96);
      return;
    }
    const threshold = normalizedAlias.length >= 10 ? 0.70 : 0.76;
    const score = similarity(candidate, normalizedAlias);
    if (score >= threshold) bestConfidence = Math.max(bestConfidence, Math.round(score * 100));
  });
  const windowThreshold = normalizedAlias.length >= 10 ? 0.72 : 0.80;
  const windowScore = bestWindowSimilarity(normalizedSource, normalizedAlias);
  if (windowScore >= windowThreshold) bestConfidence = Math.max(bestConfidence, Math.round(windowScore * 100));
  return bestConfidence ? { confidence: bestConfidence, alias, matchType: 'fuzzy' } : null;
}

export function detectGroups(groups, sourceText) {
  const candidateNames = splitCandidateNames(sourceText);
  const detected = new Map();
  groups.forEach(group => {
    const matches = group.aliases
      .map(alias => aliasMatch(sourceText, candidateNames, alias))
      .filter(Boolean)
      .sort((left, right) => right.confidence - left.confidence);
    if (!matches.length) return;
    const previous = detected.get(group.name);
    const next = { ...group, ...matches[0] };
    if (!previous || next.confidence > previous.confidence) detected.set(group.name, next);
  });
  return [...detected.values()];
}
