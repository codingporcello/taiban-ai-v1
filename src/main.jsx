import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, ImagePlus,
  LoaderCircle, MapPin, Plus, RotateCcw, ScanText, Sparkles, Star, Ticket,
  Upload, X, XCircle, ZoomIn
} from 'lucide-react';
import { DAY_SCORE, GROUP_TIERS, PLACES, SCORE_LIMITS } from './config/scoring.js';
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
  if (price == null) return { score: 0, note: '票價未辨識，請手動輸入票價' };
  if (price <= 2500) return { score: 10, note: '票價友善，CP 值高' };
  if (price <= 3500) return { score: 8, note: '票價落在合理區間' };
  if (price <= 4500) return { score: 5, note: '票價略高但仍可接受' };
  if (price <= 6000) return { score: 2, note: '票價偏高，需要更強陣容' };
  return { score: 0, note: '票價超過 6000 円' };
}

function parsePosterText(text) {
  const place = PLACES.find(([, , aliases]) => aliases.some(alias => includesLoose(text, alias)));
  const day = text.match(/[（(]([月火水木金土日])[）)]/)?.[1];
  return {
    day,
    venue: place?.[0],
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

function analyze({ text, manualGroups, addedGroups, excludedGroups, day, venue, prices }) {
  const excluded = new Set(excludedGroups);
  const textGroups = detectGroups(GROUP_TIERS, text)
    .filter(group => group.confidence >= OCR_GROUP_CONFIDENCE_THRESHOLD)
    .map(group => ({ ...group, source: 'OCR / 海報文字' }));
  const correctedGroups = detectGroups(GROUP_TIERS, manualGroups).map(group => ({ ...group, source: '手動補正' }));
  const selectedGroups = GROUP_TIERS
    .filter(group => addedGroups.includes(group.name))
    .map(group => ({ ...group, confidence: 100, matchType: 'manual', source: '手動新增' }));
  const groups = uniqueGroups([...textGroups, ...correctedGroups, ...selectedGroups])
    .filter(group => !excluded.has(group.name));
  const groupScore = Math.min(groups.reduce((sum, group) => sum + group.score, 0), SCORE_LIMITS.group);
  const dayScore = DAY_SCORE[day] ?? 0;
  const place = PLACES.find(([, , aliases]) => aliases.some(alias => includesLoose(`${venue}\n${text}`, alias)));
  const placeScore = place?.[1] ?? 0;
  const selectedPrice = selectPrice(prices);
  const otherPrices = listOtherPrices(prices, selectedPrice?.type);
  const priceInfo = priceScore(selectedPrice?.amount ?? null);
  const total = Math.min(SCORE_LIMITS.total, groupScore + placeScore + dayScore + priceInfo.score);
  const premiumGroups = groups.filter(group => ['S', 'A+', 'A'].includes(group.tier));
  const highRisk = groups.some(group => group.tier === 'S') || premiumGroups.length >= 3;
  const verdict = total >= 80 ? '強烈推薦' : total >= 65 ? '值得一去' : total >= 50 ? '可以觀望' : '建議省下來';
  const ticketAdvice = selectedPrice == null
    ? '票價未辨識，請手動輸入票價。'
    : selectedPrice.type === 'premium'
      ? '目前只有高價票，建議先確認是否會追加一般票。'
      : selectedPrice.type === 'door'
        ? '目前只有当日票，現場票可能較貴。'
        : prices.premium != null && prices.premium - selectedPrice.amount <= 2000 && total >= 80
          ? '前方票與一般票差額不大，可考慮前方票。'
          : '普通票即可。';
  const recommendation = total >= 80
    ? '陣容與條件都很漂亮，普通票可以直接拿下。'
    : total >= 65
      ? '整體值得去，建議先以普通票為主，不必急著加碼前方票。'
      : total >= 50
        ? '有亮點但不算必去，可以等追加陣容或臨近活動再決定。'
        : '目前條件不夠突出，先把預算留給更好的対バン。';

  const pros = [];
  const cons = [];
  if (groupScore >= 35) pros.push('出演陣容含有多組高順位團體');
  else if (groups.length) pros.push(`已命中 ${groups.length} 組關注團體`);
  else cons.push('尚未命中關注團體');
  if (dayScore >= 7) pros.push('日期落在週末或週五，時間安排友善');
  else if (dayScore <= 3) cons.push('平日活動，需要評估行程成本');
  if (placeScore >= 16) pros.push(`${place?.[0] || venue} 是高分場地`);
  else if (placeScore <= 4) cons.push('會場地點加分較少');
  if (selectedPrice == null) cons.push('票價未辨識，請手動輸入票價');
  else if (priceInfo.score >= 8) pros.push(priceInfo.note);
  else if (priceInfo.score <= 2) cons.push(priceInfo.note);
  if (selectedPrice?.type === 'premium') cons.push('只有高價票');
  if (selectedPrice?.type === 'door') cons.push('只有当日票，現場票可能較貴');

  return { total, verdict, groups, groupScore, dayScore, placeScore, priceInfo, selectedPrice, otherPrices, ticketAdvice, highRisk, recommendation, pros, cons };
}

function createEmptyResult() {
  return analyze({
    text: '', manualGroups: '', addedGroups: [], excludedGroups: [], day: '', venue: '', prices: {},
  });
}

function App() {
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [text, setText] = useState('');
  const [manualGroups, setManualGroups] = useState('');
  const [day, setDay] = useState('土');
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
  const draftSignature = JSON.stringify({ text, manualGroups, addedGroups, excludedGroups, day, venue, prices });
  const draftResult = useMemo(() => analyze({
    text, manualGroups, addedGroups, excludedGroups, day, venue, prices,
  }), [text, manualGroups, addedGroups, excludedGroups, day, venue, prices]);
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
      const nextVenue = parsed.venue || venue;
      applyDetectedText(nextText);
      setOcrLog({ ...log, acceptedGroupCount, finishedAt: new Date().toISOString() });
      setOcrState({ status: 'done', progress: 1 });
      const nextPrices = mergePrices(parsed.prices, manualPrices);
      const nextSignature = JSON.stringify({
        text: nextText, manualGroups, addedGroups, excludedGroups, day: nextDay, venue: nextVenue, prices: nextPrices,
      });
      runScoring(analyze({
        text: nextText, manualGroups, addedGroups, excludedGroups, day: nextDay, venue: nextVenue, prices: nextPrices,
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
          <p className="hero-copy">上傳活動海報，依照你的偏好即時分析出演陣容、地點、日期與票價。</p>
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
              <div><span className="step">01</span><h2>上傳活動海報</h2></div>
              {image && <span className="mini-status"><CheckCircle2 size={14} /> 已上傳</span>}
            </div>
            {image
              ? <div className="dropzone has-image poster-preview">
                <button className="poster-zoom" onClick={() => setImageExpanded(true)}>
                  <img src={image} alt="活動海報預覽" />
                  <span><ZoomIn size={14} /> 點擊放大</span>
                </button>
                <label className="replace"><Upload size={14} /> 更換圖片<input key={fileInputKey} type="file" accept="image/*" onChange={onFile} /></label>
              </div>
              : <label className="dropzone">
                <div className="dropzone-empty"><span><ImagePlus size={26} /></span><b>選擇海報圖片</b><small>支援 JPG、PNG、WEBP</small></div>
                <input key={fileInputKey} type="file" accept="image/*" onChange={onFile} />
              </label>}
            {imageExpanded && <div className="poster-modal" role="dialog" aria-label="放大海報" onClick={() => setImageExpanded(false)}>
              <button className="poster-modal-close" onClick={() => setImageExpanded(false)}><X size={18} /> 關閉</button>
              <img src={image} alt="放大的活動海報，點擊可縮小" />
              <span>點擊圖片或背景即可返回</span>
            </div>}
            <div className="ocr-control"><span>免費版 OCR</span><b>Tesseract OCR</b></div>
            <button className="primary-button" disabled={!imageFile || ocrState.status === 'loading'} onClick={runOcr}>
              {ocrState.status === 'loading'
                ? <><LoaderCircle className="spin" size={18} /> 辨識中 {Math.round(ocrState.progress * 100)}%</>
                : <><ScanText size={18} /> 開始 OCR 自動辨識</>}
            </button>
            {ocrState.status === 'error' && <p className="error">{ocrState.message}</p>}
            {ocrState.status === 'error' && <p className="muted manual-hint">辨識失敗也沒關係，可以直接在下方貼上活動文字或團名清單。</p>}
            {ocrLog && <div className="ocr-log">
              <div><b>最近一次 OCR</b><span className={`log-status ${ocrLog.status === 'success' ? 'ok' : ''}`}>{ocrLog.status}</span></div>
              <dl>
                <dt>Provider</dt><dd>{ocrLog.provider}</dd>
                <dt>OpenAI API 呼叫</dt><dd>{ocrLog.openaiApiCalled ? '已呼叫' : '未呼叫'}</dd>
                <dt>OpenAI 回傳結果</dt><dd>{ocrLog.openaiResponseReceived ? '已收到' : '未收到'}</dd>
                {ocrLog.confidence != null && <><dt>OCR 辨識信心值</dt><dd>{ocrLog.confidence}%</dd></>}
                {ocrLog.openaiResponseStatus && <><dt>HTTP 狀態</dt><dd>{ocrLog.openaiResponseStatus}</dd></>}
                {ocrLog.textLength != null && <><dt>辨識文字長度</dt><dd>{ocrLog.textLength}</dd></>}
                {ocrLog.updatedAt && <><dt>最後更新</dt><dd>{new Date(ocrLog.updatedAt).toLocaleString()}</dd></>}
              </dl>
            </div>}
            {ocrLog?.confidence != null && <div className={`confidence-notice ${ocrLog.acceptedGroupCount ? 'confidence-ok' : 'confidence-low'}`}>
              <b>OCR 團體辨識信心值：{ocrLog.confidence}%</b>
              <span>{ocrLog.acceptedGroupCount
                ? `已辨識 ${ocrLog.acceptedGroupCount} 組達到信心門檻的團體，按下評分按鈕後套用，其餘可在下方手動補正。`
                : `目前沒有團體達到 ${OCR_GROUP_CONFIDENCE_THRESHOLD}% 門檻，請在下方手動補正。`}</span>
            </div>}
          </section>

          <section className="glass form-card">
            <div className="section-heading"><div><span className="step">02</span><h2>確認辨識內容</h2></div></div>
            <label className="field full"><span>海報文字 <small>可手動修正</small></span><textarea value={text} onChange={event => applyDetectedText(event.target.value)} placeholder="OCR 結果會顯示在這裡，也可以直接貼上海報文字。" /></label>
            <div className="form-grid">
              <label className="field"><span><CalendarDays size={15} /> 星期</span><select value={day} onChange={event => setDay(event.target.value)}>{['土', '日', '金', '月', '火', '水', '木'].map(value => <option key={value}>{value}</option>)}</select></label>
              <div className="field full"><span><Ticket size={15} /> 手動修正票價 <small>留白時使用海報辨識結果</small></span><div className="price-grid">
                <label><small>一般票</small><div className="suffix"><input type="number" value={manualPrices.general} onChange={event => setManualPrices(prices => ({ ...prices, general: event.target.value }))} placeholder={detectedPrices.general ?? detectedPrices.adv ?? '未辨識'} /><i>円</i></div></label>
                <label><small>前方票</small><div className="suffix"><input type="number" value={manualPrices.premium} onChange={event => setManualPrices(prices => ({ ...prices, premium: event.target.value }))} placeholder={detectedPrices.premium ?? '未辨識'} /><i>円</i></div></label>
                <label><small>当日票</small><div className="suffix"><input type="number" value={manualPrices.door} onChange={event => setManualPrices(prices => ({ ...prices, door: event.target.value }))} placeholder={detectedPrices.door ?? '未辨識'} /><i>円</i></div></label>
              </div></div>
              <label className="field full"><span><MapPin size={15} /> 會場 / 地區 <small>OCR 抓不到時可手動選擇</small></span><select value={venue} onChange={event => setVenue(event.target.value)}>
                <option value="">請選擇會場</option>
                {PLACES.map(([name, score]) => <option key={name} value={name}>{name}（{score}分）</option>)}
              </select></label>
            </div>
            <label className="field full group-correction"><span>手動補正團名 <small>一行一團，可直接貼上出演清單</small></span><textarea className="group-list" value={manualGroups} onChange={event => setManualGroups(event.target.value)} placeholder={'例如：\nMerry BAD TUNE\nMirror Mirror\nHIBANA'} /></label>
            <div className="group-picker">
              <span>所有團體 <small>點選即可加入評分</small></span>
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
            <div className="section-heading"><div><span className="step">03</span><h2>AI 評分結果</h2></div><span className="live"><i /> LIVE</span></div>
            <div className="score-ring" style={{ '--score': `${animatedScore * 3.6}deg` }}>
              <div><strong>{animatedScore}</strong><small>/ 100</small></div>
            </div>
            <button className="score-trigger" onClick={() => runScoring()}>
              <ScanText size={15} /> {hasPendingChanges ? '重新評分' : '播放動畫'}
            </button>
            {hasPendingChanges && <p className="pending-note">條件已變更，按下按鈕後更新評分。</p>}
            <div className="verdict"><span>{result.verdict}</span><p>{result.recommendation}</p></div>
            <div className={`risk ${result.highRisk ? 'risk-high' : ''}`}>
              <AlertTriangle size={17} /><div><small>爆死風險</small><b>{result.highRisk ? '高' : '普通'}</b></div>
            </div>
            <ul className="breakdown">
              {[
                [Star, '團體價值', result.groupScore, 50],
                [MapPin, '場地', result.placeScore, 20],
                [CalendarDays, '日期', result.dayScore, 10],
                [Ticket, '票價', result.priceInfo.score, 10],
              ].map(([Icon, label, score, limit]) => <li key={label}>
                <div><span><Icon /> {label}</span><b>{score}<small>/{limit}</small></b></div>
                <i><em style={{ width: `${score / limit * 100}%` }} /></i>
              </li>)}
            </ul>
            <div className="price-summary">
              <p><b>推薦使用票價</b><span>{result.selectedPrice ? `${result.selectedPrice.label} ${result.selectedPrice.amount}円` : '票價未辨識'}</span></p>
              <p><b>其他票價</b><span>{result.otherPrices.length ? result.otherPrices.map(price => `${price.label} ${price.amount}円`).join('、') : '無'}</span></p>
              <em>{result.ticketAdvice}</em>
            </div>
          </section>
        </aside>
      </section>

      <section className="glass details">
        <div className="section-heading"><div><span className="step">04</span><h2>分析詳情</h2></div></div>
        <div className="details-grid">
          <div>
            <h3>出演團體</h3>
            {displayedGroups.length
              ? <div className="chips">{displayedGroups.map(group => <span className={`chip ${tierClass(group.tier)}`} key={group.name}>
                <b>{group.tier}</b><span>{group.name}<small>{group.source} · {group.confidence}%</small></span>
                <button aria-label={`刪除 ${group.name}`} onClick={() => removeGroup(group.name)}><X size={12} /></button>
              </span>)}</div>
              : <p className="muted">貼上海報文字或執行 OCR 後，出演團體會顯示在這裡。</p>}
          </div>
          <div className="insights">
            <div><h3><CheckCircle2 /> 優點</h3>{result.pros.length ? result.pros.map(item => <p key={item}>{item}</p>) : <p className="muted">尚無明顯優點</p>}</div>
            <div><h3><XCircle /> 注意事項</h3>{result.cons.length ? result.cons.map(item => <p key={item}>{item}</p>) : <p className="muted">沒有明顯缺點</p>}</div>
          </div>
        </div>
      </section>

      <footer><span>TAIBAN AI</span><small>Built for better live decisions <ChevronRight size={13} /></small></footer>
      <button className="floating-clear" onClick={clearAll}><RotateCcw size={15} /> 全部清除</button>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
