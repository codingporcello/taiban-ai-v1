export const GROUP_TIERS = [
  { tier: 'S', score: 25, name: 'AsIs', aliases: ['AsIs'] },
  { tier: 'S', score: 25, name: 'Merry BAD TUNE', aliases: ['Merry BAD TUNE', 'MerryBADTUNE', 'メリーBADTUNE'] },
  { tier: 'A', score: 15, name: 'ハルニシオン', aliases: ['ハルニシオン'] },
  { tier: 'A', score: 15, name: 'HIBANA', aliases: ['HIBANA'] },
  { tier: 'A', score: 15, name: 'NEO JAPONISM', aliases: ['NEO JAPONISM'] },
  { tier: 'A', score: 15, name: 'Mirror,Mirror', aliases: ['Mirror,Mirror', 'Mirror Mirror'] },
  { tier: 'A', score: 15, name: 'なみだ色の消しごむ', aliases: ['なみだ色の消しごむ'] },
  { tier: 'B', score: 8, name: 'UtaGe!', aliases: ['UtaGe!', 'UtaGe'] },
  { tier: 'B', score: 8, name: 'ドラマチックレコード', aliases: ['ドラマチックレコード'] },
  { tier: 'B', score: 8, name: 'Jams Collection', aliases: ['Jams Collection'] },
  { tier: 'B', score: 8, name: 'Sweet Alley', aliases: ['Sweet Alley'] },
  { tier: 'C', score: 3, name: 'THE ORCHESTRA TOKYO', aliases: ['THE ORCHESTRA TOKYO', 'THE ORCHESTAR TOKYO'] },
  { tier: 'C', score: 3, name: 'Devil ANTHEM.', aliases: ['Devil ANTHEM.', 'Devil ANTHEM'] },
];

export const DAY_SCORE = { '土': 10, '日': 10, '金': 7, '月': 3, '火': 0, '水': 0, '木': 0 };

export const PLACES = [
  ['渋谷', 10, ['渋谷', 'SHIBUYA']],
  ['新宿', 8, ['新宿', 'SHINJUKU']],
  ['品川', 6, ['品川', 'SHINAGAWA']],
  ['神田', 4, ['神田', 'KANDA']],
  ['白金高輪', 2, ['白金高輪']],
  ['川崎', 0, ['川崎', 'KAWASAKI']],
];

export const RARE_KEYWORDS = [
  ['解散', 20], ['現体制終了', 20], ['ラスト', 18], ['LAST', 18],
  ['卒業', 16], ['生誕', 14], ['周年', 10], ['主催', 8],
];

export const SCORE_LIMITS = { total: 100, group: 50, rarity: 20 };
