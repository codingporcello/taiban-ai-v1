import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, ImagePlus,
  LoaderCircle, MapPin, Plus, RotateCcw, ScanText, Sparkles, Star, Ticket,
  Upload, X, XCircle, ZoomIn
} from 'lucide-react';
import { AREAS, DAY_SCORE, GROUP_TIERS, SCORE_LIMITS, VENUES } from './config/scoring.js';
import { recognizePoster } from './services/ocr/index.js';
import { detectGroups } from './services/matching/groups.js';
import { listOtherPrices, mergePrices, parsePrices, selectPrice } from './services/matching/prices.js';
import './style.css';

const OCR_GROUP_CONFIDENCE_THRESHOLD = 65;

function normalizeText(value) {
  return (value || '').normalize('NFKC').toLowerCase();
}

function includesLoose(text, keyword) {
  return normalizeText(text).includes(normalizeText(keyword));
}

function priceScore(price) {
  if (price == null) return { score: 0, note: 'チケット料金未検出。手動入力してください' };
  if (price <= 2500) return { score: 10, note: 'チケット代が安く、コスパ良好' };
  if (price <= 3500) return { score: 8, note: 'チケット代は標準的' };
  if (price <= 4500) return { score: 5, note: 'チケット代はやや高め' };
  if (price <= 6000) return { score: 2, note: 'チケット代が高め。強い出演陣が必要' };
  return { score: 0, note: 'チケット代が 6000 円超え' };
}

function parsePosterText(text) {
  const area = AREAS.find(([, , aliases]) => aliases.some(alias => includesLoose(text, alias)));
  const venue = VENUES.find(([, , aliases]) => aliases.some(alias => includesLoose(text, alias)));
  const day = text.match(/[（(]([月火水木金土日])[）)]/)?.[1];
  return {
    day,
    area: area?.[0],
    venue: venue?.[0],
    prices: parsePrices(text),
  };
}

function uniqueGroups(groups) {
  const unique = new Map();
  groups.forEach(group => {
    const previous = unique.get(group.name);
    if (!previous || (group.confidence || 0) > (previous.confidence || 0)) unique.set(group.name, group);
  });
  return [...unique.values()];
}

function tierClass(tier) {
  return `tier-${String(tier).replace('+', 'plus')}`;
}

function analyze({ text, manualGroups, addedGroups, excludedGroups, day, area, venue, prices }) {
  const excluded = new Set(excludedGroups);
  const textGroups = detectGroups(GROUP_TIERS, text)
    .filter(group => group.confidence >= OCR_GROUP_CONFIDENCE_THRESHOLD)
    .map(group => ({ ...group, source: 'OCR / ポスター文字' }));
  const correctedGroups = detectGroups(GROUP_TIERS, manualGroups).map(group => ({ ...group, source: '手動補正' }));
  const selectedGroups = GROUP_TIERS
    .filter(group => addedGroups.includes(group.name))
    .map(group => ({ ...group, confidence: 100, matchType: 'manual', source: '手動追加' }));
  const groups = uniqueGroups([...textGroups, ...correctedGroups, ...selectedGroups])
    .filter(group => !excluded.has(group.name));
  const groupScore = Math.min(groups.reduce((sum, group) => sum + group.score, 0), SCORE_LIMITS.group);
  const dayScore = DAY_SCORE[day] ?? 0;
  const areaMatch = AREAS.find(([, , aliases]) => aliases.some(alias => includesLoose(`${area}\n${text}`, alias)));
  const areaScore = areaMatch?.[1] ?? 0;
  const venueMatch = VENUES.find(([, , aliases]) => aliases.some(alias => includesLoose(`${venue}\n${text}`, alias)));
  const venueScore = venueMatch?.[1] ?? 0;
  const selectedPrice = selectPrice(prices);
  const otherPrices = listOtherPrices(prices, selectedPrice?.type);
  const priceInfo = priceScore(selectedPrice?.amount ?? null);
  const total = Math.min(SCORE_LIMITS.total, groupScore + venueScore + areaScore + dayScore + priceInfo.score);
  const premiumGroups = groups.filter(group => ['S', 'A+', 'A'].includes(group.tier));
  const highRisk = groups.some(group => group.tier === 'S') || premiumGroups.length >= 3;
  const verdict = total >= 80 ? '強くおすすめ' : total >= 65 ? '行く価値あり' : total >= 50 ? '様子見' : '見送り候補';
  const ticketAdvice = selectedPrice == null
    ? 'チケット料金が未検出です。手動で入力してください。'
    : selectedPrice.type === 'premium'
      ? '高額チケットのみ検出。通常チケットの有無を確認してください。'
      : selectedPrice.type === 'door'
        ? '当日券のみ検出。現場価格は高めの可能性があります。'
        : prices.premium != null && prices.premium - selectedPrice.amount <= 2000 && total >= 80
          ? '前方との差額が小さいため、前方チケットも検討可。'
          : '通常チケットで十分。';
  const recommendation = total >= 80
    ? '出演陣と条件がかなり良いです。通常チケットなら前向きに検討。'
    : total >= 65
      ? '全体的に行く価値あり。まずは通常チケット中心で判断。'
      : total >= 50
        ? '良い点はありますが必須ではありません。追加情報待ちでもOK。'
        : '現時点では決め手が弱め。予算は別の対バンに回してもよさそう。';

  const pros = [];
  const cons = [];
  if (groupScore >= 35) pros.push('高評価グループが複数出演');
  else if (groups.length) pros.push(`${groups.length} 組の注目グループを検出`);
  else cons.push('注目グループ未検出');
  if (dayScore >= 7) pros.push('週末または金曜で行きやすい日程');
  else if (dayScore <= 3) cons.push('平日開催のため予定調整が必要');
  if (venueScore >= 16) pros.push(`${venueMatch?.[0] || venue} は高評価会場`);
  else if (venueScore <= 4) cons.push('会場スコアは低め');
  if (areaScore >= 8) pros.push(`${areaMatch?.[0] || area} エリアは行きやすい`);
  else if (areaScore <= 2) cons.push('エリア加点は少なめ');
  if (selectedPrice == null) cons.push('チケット料金未検出。手動入力推奨');
  else if (priceInfo.score >= 8) pros.push(priceInfo.note);
  else if (priceInfo.score <= 2) cons.push(priceInfo.note);
  if (selectedPrice?.type === 'premium') cons.push('高額チケットのみ');
  if (selectedPrice?.type === 'door') cons.push('当日券のみ。現場価格が高い可能性あり');

  return { total, verdict, groups, groupScore, dayScore, areaScore, venueScore, priceInfo, selectedPrice, otherPrices, ticketAdvice, highRisk, recommendation, pros, cons };
}

function createEmptyResult() {
  return analyze({
    text: '', manualGroups: '', addedGroups: [], excludedGroups: [], day: '', area: '', venue: '', prices: {},
  });
}

function App() {
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [text, setText] = useState('');
  const [manualGroups, setManualGroups] = useState('');
  const [day, setDay] = useState('土');
  const [area, setArea] = useState('');
  const [venue, setVenue] = useState('');
  const [detectedPrices, setDetectedPrices] = useState({});
  const [manualPrices, setManualPrices] = useState({ general: '', premium: '', door: '' });
  const [ocrState, setOcrState] = useState({ status: 'idle', progress: 0 });
  const [ocrLog, setOcrLog] = useState(null);
  const [addedGroups, setAddedGroups] = useState([]);
  const [excludedGroups, setExcludedGroups] = useState([]);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [scoreAnimationKey, setScoreAnimationKey] = useState(0);
  const [committedSignature, setCommittedSignature] = useState('');
  const [scoreCardCompact, setScoreCardCompact] = useState(false);
  const prices = useMemo(() => mergePrices(detectedPrices, manualPrices), [detectedPrices, manualPrices]);
  const draftSignature = JSON.stringify({ text, manualGroups, addedGroups, excludedGroups, day, area, venue, prices });
  const draftResult = useMemo(() => analyze({
    text, manualGroups, addedGroups, excludedGroups, day, area, venue, prices,
  }), [text, manualGroups, addedGroups, excludedGroups, day, area, venue, prices]);
  const [result, setResult] = useState(createEmptyResult);
  const hasPendingChanges = draftSignature !== committedSignature;

  useEffect(() => () => image && URL.revokeObjectURL(image), [image]);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 720;
    function animate(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setAnimatedScore(Math.round(result.total * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    setAnimatedScore(0);
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [result.total, scoreAnimationKey]);

  useEffect(() => {
    function onScroll() {
      setScoreCardCompact(window.innerWidth > 840 && window.scrollY > 920);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function runScoring(nextResult = draftResult, nextSignature = draftSignature) {
    setAnimatedScore(0);
    setResult(nextResult);
    setCommittedSignature(nextSignature);
    setScoreAnimationKey(key => key + 1);
  }

  function applyDetectedText(nextText) {
    const parsed = parsePosterText(nextText);
    setText(nextText);
    if (parsed.day) setDay(parsed.day);
    if (parsed.area) setArea(parsed.area);
    if (parsed.venue) setVenue(parsed.venue);
    setDetectedPrices(parsed.prices);
  }

  function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    setImageFile(file);
    setImageExpanded(false);
    setOcrLog(null);
    setOcrState({ status: 'ready', progress: 0 });
  }

  function addGroup(name) {
    setAddedGroups(groups => groups.includes(name) ? groups : [...groups, name]);
    setExcludedGroups(groups => groups.filter(group => group !== name));
  }

  function removeGroup(name) {
    setAddedGroups(groups => groups.filter(group => group !== name));
    setExcludedGroups(groups => groups.includes(name) ? groups : [...groups, name]);
  }

  function clearAll() {
    if (image) URL.revokeObjectURL(image);
    setImage('');
    setImageFile(null);
    setText('');
    setManualGroups('');
    setDay('土');
    setArea('');
    setVenue('');
    setDetectedPrices({});
    setManualPrices({ general: '', premium: '', door: '' });
    setOcrState({ status: 'idle', progress: 0 });
    setOcrLog(null);
    setAddedGroups([]);
    setExcludedGroups([]);
    setImageExpanded(false);
    setFileInputKey(key => key + 1);
    setResult(createEmptyResult());
    setAnimatedScore(0);
    setCommittedSignature('');
  }

  async function runOcr() {
    if (!imageFile) return;
    setOcrState({ status: 'loading', progress: 0 });
    try {
      const { text: nextText, log } = await recognizePoster('tesseract', imageFile, {
        onProgress: ({ status, progress = 0 }) => setOcrState({ status, progress }),
      });
      const acceptedGroupCount = detectGroups(GROUP_TIERS, nextText)
        .filter(group => group.confidence >= OCR_GROUP_CONFIDENCE_THRESHOLD).length;
      const parsed = parsePosterText(nextText);
      const nextDay = parsed.day || day;
      const nextArea = parsed.area || area;
      const nextVenue = parsed.venue || venue;
      applyDetectedText(nextText);
      setOcrLog({ ...log, acceptedGroupCount, finishedAt: new Date().toISOString() });
      setOcrState({ status: 'done', progress: 1 });
      const nextPrices = mergePrices(parsed.prices, manualPrices);
      const nextSignature = JSON.stringify({
        text: nextText, manualGroups, addedGroups, excludedGroups, day: nextDay, area: nextArea, venue: nextVenue, prices: nextPrices,
      });
      runScoring(analyze({
        text: nextText, manualGroups, addedGroups, excludedGroups, day: nextDay, area: nextArea, venue: nextVenue, prices: nextPrices,
      }), nextSignature);
    } catch (error) {
      setOcrLog(error.log || {
        provider: 'Tesseract OCR',
        status: 'error',
        openaiApiCalled: false,
        openaiResponseReceived: false,
        error: error.message,
        finishedAt: new Date().toISOString(),
      });
      setOcrState({ status: 'error', progress: 0, message: error.message });
    }
  }

  const displayedGroups = result.groups.filter(group => !excludedGroups.includes(group.name));

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <div><b>TAIBAN AI</b><small>LIVE INTELLIGENCE</small></div>
        </div>
        <div className="topbar-meta">
          <span>Tokyo Night Edition</span>
          <span className="status"><i /> Live scoring</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-main">
          <p className="eyebrow"><i /> LIVE HOUSE INTELLIGENCE / TOKYO</p>
          <h1><span className="hero-jp">対バン</span><br /><span className="hero-ai">AI SCORING</span></h1>
          <p className="hero-lead">今夜のライブ、行くべき？</p>
          <p className="hero-copy">ポスターを読み取り、出演者・エリア・会場・日程・料金からおすすめ度を判定します。</p>
          <div className="hero-tags"><span>OCR POSTER SCAN</span><span>PERSONAL RANKING</span><span>FREE MODE</span></div>
        </div>
        <div className="hero-panel glass">
          <span className="hero-panel-label">SYSTEM STATUS</span>
          <strong><i /> READY TO SCAN</strong>
          <small>Upload poster / Analyze line-up / Decide tonight</small>
        </div>
      </section>

      <section className="workspace">
        <div className="input-column">
          <section className="glass upload-card">
            <div className="section-heading">
              <div><span className="step">01</span><h2>ポスターをアップロード</h2></div>
              {image && <span className="mini-status"><CheckCircle2 size={14} /> アップロード済み</span>}
            </div>
            {image
              ? <div className="dropzone has-image poster-preview">
                <button className="poster-zoom" onClick={() => setImageExpanded(true)}>
                  <img src={image} alt="ポスターのプレビュー" />
                  <span><ZoomIn size={14} /> 拡大表示</span>
                </button>
                <label className="replace"><Upload size={14} /> 画像を変更<input key={fileInputKey} type="file" accept="image/*" onChange={onFile} /></label>
              </div>
              : <label className="dropzone">
                <div className="dropzone-empty"><span><ImagePlus size={26} /></span><b>ポスター画像を選択</b><small>JPG・PNG・WEBP 対応</small></div>
                <input key={fileInputKey} type="file" accept="image/*" onChange={onFile} />
              </label>}
            {imageExpanded && <div className="poster-modal" role="dialog" aria-label="ポスター拡大表示" onClick={() => setImageExpanded(false)}>
              <button className="poster-modal-close" onClick={() => setImageExpanded(false)}><X size={18} /> 閉じる</button>
              <img src={image} alt="拡大したポスター。クリックで戻ります" />
              <span>画像または背景をクリックすると戻ります</span>
            </div>}
            <div className="ocr-control"><span>無料 OCR</span><b>Tesseract OCR</b></div>
            <button className="primary-button" disabled={!imageFile || ocrState.status === 'loading'} onClick={runOcr}>
              {ocrState.status === 'loading'
                ? <><LoaderCircle className="spin" size={18} /> 読み取り中 {Math.round(ocrState.progress * 100)}%</>
                : <><ScanText size={18} /> OCR 自動読み取り</>}
            </button>
            {ocrState.status === 'error' && <p className="error">{ocrState.message}</p>}
            {ocrState.status === 'error' && <p className="muted manual-hint">読み取りに失敗しても、下にイベント本文や出演者リストを貼り付けられます。</p>}
            {ocrLog && <div className="ocr-log">
              <div><b>最新 OCR</b><span className={`log-status ${ocrLog.status === 'success' ? 'ok' : ''}`}>{ocrLog.status}</span></div>
              <dl>
                <dt>Provider</dt><dd>{ocrLog.provider}</dd>
                <dt>OpenAI API 呼び出し</dt><dd>{ocrLog.openaiApiCalled ? '呼び出し済み' : '未使用'}</dd>
                <dt>OpenAI 応答</dt><dd>{ocrLog.openaiResponseReceived ? '受信済み' : '未受信'}</dd>
                {ocrLog.confidence != null && <><dt>OCR 信頼度</dt><dd>{ocrLog.confidence}%</dd></>}
                {ocrLog.openaiResponseStatus && <><dt>HTTP 状態</dt><dd>{ocrLog.openaiResponseStatus}</dd></>}
                {ocrLog.textLength != null && <><dt>読み取り文字数</dt><dd>{ocrLog.textLength}</dd></>}
                {ocrLog.updatedAt && <><dt>最終更新</dt><dd>{new Date(ocrLog.updatedAt).toLocaleString()}</dd></>}
              </dl>
            </div>}
            {ocrLog?.confidence != null && <div className={`confidence-notice ${ocrLog.acceptedGroupCount ? 'confidence-ok' : 'confidence-low'}`}>
              <b>OCR グループ認識信頼度：{ocrLog.confidence}%</b>
              <span>{ocrLog.acceptedGroupCount
                ? `${ocrLog.acceptedGroupCount} 組が信頼度基準を超えました。採点ボタンを押すと反映されます。`
                : `現在 ${OCR_GROUP_CONFIDENCE_THRESHOLD}% 以上のグループはありません。下で手動補正してください。`}</span>
            </div>}
          </section>

          <section className="glass form-card">
            <div className="section-heading"><div><span className="step">02</span><h2>読み取り内容の確認</h2></div></div>
            <label className="field full"><span>ポスター本文 <small>手動修正可</small></span><textarea value={text} onChange={event => applyDetectedText(event.target.value)} placeholder="OCR 結果がここに表示されます。イベント本文を直接貼り付けてもOKです。" /></label>
            <div className="form-grid">
              <label className="field"><span><CalendarDays size={15} /> 曜日</span><select value={day} onChange={event => setDay(event.target.value)}>{['土', '日', '金', '月', '火', '水', '木'].map(value => <option key={value}>{value}</option>)}</select></label>
              <div className="field full"><span><Ticket size={15} /> 料金の手動修正 <small>空欄ならポスター読み取り結果を使用</small></span><div className="price-grid">
                <label><small>通常</small><div className="suffix"><input type="number" value={manualPrices.general} onChange={event => setManualPrices(prices => ({ ...prices, general: event.target.value }))} placeholder={detectedPrices.general ?? detectedPrices.adv ?? '未検出'} /><i>円</i></div></label>
                <label><small>前方</small><div className="suffix"><input type="number" value={manualPrices.premium} onChange={event => setManualPrices(prices => ({ ...prices, premium: event.target.value }))} placeholder={detectedPrices.premium ?? '未検出'} /><i>円</i></div></label>
                <label><small>当日</small><div className="suffix"><input type="number" value={manualPrices.door} onChange={event => setManualPrices(prices => ({ ...prices, door: event.target.value }))} placeholder={detectedPrices.door ?? '未検出'} /><i>円</i></div></label>
              </div></div>
              <label className="field"><span><MapPin size={15} /> エリア <small>読み取れない時は選択</small></span><select value={area} onChange={event => setArea(event.target.value)}>
                <option value="">エリアを選択</option>
                {AREAS.map(([name, score]) => <option key={name} value={name}>{name}（{score}点）</option>)}
              </select></label>
              <label className="field"><span><MapPin size={15} /> 会場 <small>読み取れない時は選択</small></span><select value={venue} onChange={event => setVenue(event.target.value)}>
                <option value="">会場を選択</option>
                {VENUES.map(([name, score]) => <option key={name} value={name}>{name}（{score}点）</option>)}
              </select></label>
            </div>
            <label className="field full group-correction"><span>グループ手動補正 <small>1 行 1 組。出演者リストを貼り付け可</small></span><textarea className="group-list" value={manualGroups} onChange={event => setManualGroups(event.target.value)} placeholder={'例：\nMerry BAD TUNE\nMirror Mirror\nHIBANA'} /></label>
            <div className="group-picker">
              <span>登録グループ <small>クリックで採点に追加</small></span>
              <div>{GROUP_TIERS.map(group => {
                const active = draftResult.groups.some(resultGroup => resultGroup.name === group.name);
                return <button className={`${tierClass(group.tier)} ${active ? 'active' : ''}`} key={group.name} onClick={() => addGroup(group.name)} disabled={active}>
                  <Plus size={12} /><b>{group.tier}</b>{group.name}
                </button>;
              })}</div>
            </div>
          </section>
        </div>

        <aside className="result-column">
          <section className={`glass score-card ${scoreCardCompact ? 'is-compact' : ''}`}>
            <div className="section-heading"><div><span className="step">03</span><h2>AI 採点結果</h2></div><span className="live"><i /> LIVE</span></div>
            <div className="score-ring" style={{ '--score': `${animatedScore * 3.6}deg` }}>
              <div><strong>{animatedScore}</strong><small>/ 100</small></div>
            </div>
            <button className="score-trigger" onClick={() => runScoring()}>
              <ScanText size={15} /> {hasPendingChanges ? '再採点' : 'アニメ再生'}
            </button>
            {hasPendingChanges && <p className="pending-note">条件が変更されています。ボタンを押すと採点を更新します。</p>}
            <div className="verdict"><span>{result.verdict}</span><p>{result.recommendation}</p></div>
            <div className={`risk ${result.highRisk ? 'risk-high' : ''}`}>
              <AlertTriangle size={17} /><div><small>爆死リスク</small><b>{result.highRisk ? '高' : '通常'}</b></div>
            </div>
            <ul className="breakdown">
              {[
                [Star, 'グループ', result.groupScore, 50],
                [MapPin, '会場', result.venueScore, 20],
                [MapPin, 'エリア', result.areaScore, 10],
                [CalendarDays, '日程', result.dayScore, 10],
                [Ticket, '料金', result.priceInfo.score, 10],
              ].map(([Icon, label, score, limit]) => <li key={label}>
                <div><span><Icon /> {label}</span><b>{score}<small>/{limit}</small></b></div>
                <i><em style={{ width: `${score / limit * 100}%` }} /></i>
              </li>)}
            </ul>
            <div className="price-summary">
              <p><b>推奨使用料金</b><span>{result.selectedPrice ? `${result.selectedPrice.label} ${result.selectedPrice.amount}円` : '料金未検出'}</span></p>
              <p><b>その他の料金</b><span>{result.otherPrices.length ? result.otherPrices.map(price => `${price.label} ${price.amount}円`).join('、') : 'なし'}</span></p>
              <em>{result.ticketAdvice}</em>
            </div>
          </section>
        </aside>
      </section>

      <section className="glass details">
        <div className="section-heading"><div><span className="step">04</span><h2>分析詳細</h2></div></div>
        <div className="details-grid">
          <div>
            <h3>出演グループ</h3>
            {displayedGroups.length
              ? <div className="chips">{displayedGroups.map(group => <span className={`chip ${tierClass(group.tier)}`} key={group.name}>
                <b>{group.tier}</b><span>{group.name}<small>{group.source} · {group.confidence}%</small></span>
                <button aria-label={`${group.name} を削除`} onClick={() => removeGroup(group.name)}><X size={12} /></button>
              </span>)}</div>
              : <p className="muted">ポスター本文を貼り付けるか OCR を実行すると、出演グループがここに表示されます。</p>}
          </div>
          <div className="insights">
            <div><h3><CheckCircle2 /> 良い点</h3>{result.pros.length ? result.pros.map(item => <p key={item}>{item}</p>) : <p className="muted">目立つ良い点はまだありません</p>}</div>
            <div><h3><XCircle /> 注意点</h3>{result.cons.length ? result.cons.map(item => <p key={item}>{item}</p>) : <p className="muted">目立つ注意点はありません</p>}</div>
          </div>
        </div>
      </section>

      <footer><span>TAIBAN AI</span><small>Built for better live decisions <ChevronRight size={13} /></small></footer>
      <button className="floating-clear" onClick={clearAll}><RotateCcw size={15} /> すべてクリア</button>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
