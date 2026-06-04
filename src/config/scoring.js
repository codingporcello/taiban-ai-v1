export const GROUP_TIERS = [
  { tier: 'S', score: 15, name: 'AsIs', aliases: ['AsIs'] },
  { tier: 'S', score: 15, name: 'Merry BAD TUNE', aliases: ['Merry BAD TUNE', 'MerryBADTUNE', 'メリーBADTUNE'] },
  { tier: 'A+', score: 10, name: 'ハルニシオン', aliases: ['ハルニシオン'] },
  { tier: 'A+', score: 10, name: 'HIBANA', aliases: ['HIBANA'] },
  { tier: 'A+', score: 10, name: 'AOAO', aliases: ['AOAO'] },
  { tier: 'A+', score: 10, name: 'Mirror,Mirror', aliases: ['Mirror,Mirror', 'Mirror Mirror'] },
  { tier: 'A', score: 7, name: 'NEO JAPONISM', aliases: ['NEO JAPONISM'] },
  { tier: 'A', score: 7, name: 'THE ORCHESTRA TOKYO', aliases: ['THE ORCHESTRA TOKYO', 'THE ORCHESTAR TOKYO', 'THE ORCHESTR TOKYO'] },
  { tier: 'A', score: 7, name: 'Jams Collection', aliases: ['Jams Collection', 'JamsCollection', 'jamsCollection'] },
  { tier: 'A', score: 7, name: 'なみだ色の消しごむ', aliases: ['なみだ色の消しごむ', 'なみだの色消しごむ'] },
  { tier: 'B+', score: 4, name: 'INUWASI', aliases: ['INUWASI'] },
  { tier: 'B+', score: 4, name: 'HzMe', aliases: ['HzMe'] },
  { tier: 'B+', score: 4, name: 'UtaGe!', aliases: ['UtaGe!', 'UtaGe'] },
  { tier: 'B+', score: 4, name: 'Devil ANTHEM.', aliases: ['Devil ANTHEM.', 'Devil ANTHEM'] },
  { tier: 'B+', score: 4, name: 'My_Stage', aliases: ['My_Stage', 'My Stage', 'MyStage'] },
  { tier: 'B+', score: 4, name: 'Tohkei', aliases: ['Tohkei'] },
  { tier: 'B+', score: 4, name: 'FES☆TIVE', aliases: ['FES☆TIVE', 'FESTIVE', 'FES TIVE'] },
  { tier: 'B', score: 2, name: 'Sweet Alley', aliases: ['Sweet Alley'] },
  { tier: 'B', score: 2, name: 'fav me', aliases: ['fav me', 'favme'] },
  { tier: 'B', score: 2, name: 'ドラマチックレコード', aliases: ['ドラマチックレコード'] },
  { tier: 'B', score: 2, name: 'Palette Parade', aliases: ['Palette Parade'] },
];

export const DAY_SCORE = { '土': 10, '日': 10, '金': 7, '月': 3, '火': 0, '水': 0, '木': 0 };

export const AREAS = [
  ['渋谷', 10, ['渋谷', 'SHIBUYA']],
  ['新宿', 8, ['新宿', 'SHINJUKU']],
  ['品川', 6, ['品川', 'SHINAGAWA']],
  ['神田', 4, ['神田', 'KANDA']],
  ['田町', 2, ['田町', 'TAMACHI']],
  ['川崎', 0, ['川崎', 'KAWASAKI']],
];

export const VENUES = [
  ['品川インターシティホール', 20, ['品川インターシティホール', '品川インターシティ', 'SHINAGAWA INTERCITY HALL']],
  ['Spotify O-EAST', 16, ['Spotify O-EAST', 'O-EAST', 'OEAST']],
  ['KANDA SQUARE HALL', 12, ['KANDA SQUARE HALL', '神田スクエアホール', '神田スクエア']],
  ['Zepp Shinjuku', 12, ['Zepp Shinjuku', 'ZEPP SHINJUKU', 'Zepp新宿']],
  ['SHIBUYA PLEASURE PLEASURE', 8, ['SHIBUYA PLEASURE PLEASURE', 'PLEASURE PLEASURE']],
  ['Spotify O-WEST', 8, ['Spotify O-WEST', 'O-WEST', 'OWEST']],
  ['白金高輪SELENE', 4, ['白金高輪SELENE', 'STUDIO SELENE b2', 'SELENE b2', 'セレネ']],
  ['Toyosu PIT', 4, ['Toyosu PIT', '豊洲PIT']],
  ['Veats Shibuya', 0, ['Veats Shibuya', 'VEATS', 'Veats']],
];

export const SCORE_LIMITS = { total: 100, group: 50, venue: 20, area: 10 };
