function normalizeGroupName(value) {
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

function splitCandidateNames(value) {
  return (value || '')
    .split(/[\n\r|｜/／、;；]+/)
    .map(name => normalizeGroupName(name))
    .filter(Boolean);
}

function aliasMatch(sourceText, candidateNames, alias) {
  const normalizedAlias = normalizeGroupName(alias);
  if (!normalizedAlias) return false;
  if (normalizeGroupName(sourceText).includes(normalizedAlias)) return true;
  if (normalizedAlias.length < 5) return false;
  return candidateNames.some(candidate => {
    if (candidate.includes(normalizedAlias) || normalizedAlias.includes(candidate)) return true;
    const threshold = normalizedAlias.length >= 10 ? 0.78 : 0.84;
    return similarity(candidate, normalizedAlias) >= threshold;
  });
}

export function detectGroups(groups, sourceText) {
  const candidateNames = splitCandidateNames(sourceText);
  return groups.filter(group => group.aliases.some(alias => aliasMatch(sourceText, candidateNames, alias)));
}
