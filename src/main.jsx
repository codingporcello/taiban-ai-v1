import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, ImagePlus,
  LoaderCircle, MapPin, ScanText, Sparkles, Star, Ticket, Upload, XCircle
} from 'lucide-react';
import { DAY_SCORE, GROUP_TIERS, PLACES, RARE_KEYWORDS, SCORE_LIMITS } from './config/scoring.js';
import { recognizePoster } from './services/ocr/index.js';
import { detectGroups } from './services/matching/groups.js';
import './style.css';

function normalizeText(value) {
  return (value || '').normalize('NFKC').toLowerCase();
}

function includesLoose(text, keyword) {
  return normalizeText(text).includes(normalizeText(keyword));
}

function priceScore(price) {
  if (!price) return { score: 0, note: '票價尚未輸入' };
  if (price <= 2500) return { score: 10, note: '票價友善，CP 值高' };
  if (price <= 3500) return { score: 8, note: '票價落在合理區間' };
  if (price <= 4500) return { score: 5, note: '票價略高但仍可接受' };
  if (price <= 6000) return { score: 2, note: '票價偏高，需要更強陣容' };
  return { score: 0, note: '票價超過 6000 円' };
}

function parsePosterText(text) {
  const place = PLACES.find(([, , aliases]) => aliases.some(alias => includesLoose(text, alias)));
  const day = text.match(/[（(]([月火水木金土日])[）)]/)?.[1];
  const priceMatch = text.match(/(?:adv|前売(?:り)?|一般|ticket)?\s*[¥￥]\s*([\d,]{3,})/i);
  return {
    day,
    venue: place?.[0],
    price: priceMatch ? Number(priceMatch[1].replaceAll(',', '')) : undefined,
  };
}

function analyze({ text, manualGroups, day, venue, price }) {
  const groupSource = `${text}\n${manualGroups}`;
  const groups = detectGroups(GROUP_TIERS, groupSource);
  const groupScore = Math.min(groups.reduce((sum, group) => sum + group.score, 0), SCORE_LIMITS.group);
  const rareHits = RARE_KEYWORDS.filter(([keyword]) => includesLoose(text, keyword));
  const rareScore = Math.min(rareHits.reduce((sum, [, score]) => sum + score, 0), SCORE_LIMITS.rarity);
  const dayScore = DAY_SCORE[day] ?? 0;
  const place = PLACES.find(([, , aliases]) => aliases.some(alias => includesLoose(`${venue}\n${text}`, alias)));
  const placeScore = place?.[1] ?? 0;
  const priceInfo = priceScore(Number(price));
  const total = Math.min(SCORE_LIMITS.total, groupScore + rareScore + dayScore + placeScore + priceInfo.score);
  const premiumGroups = groups.filter(group => ['S', 'A'].includes(group.tier));
  const highRisk = groups.some(group => group.tier === 'S') || premiumGroups.length >= 3;
  const verdict = total >= 80 ? '強烈推薦' : total >= 65 ? '值得一去' : total >= 50 ? '可以觀望' : '建議省下來';
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
  if (rareHits.length) pros.push(`活動含有 ${rareHits.map(([keyword]) => keyword).join('、')} 等稀有條件`);
  if (dayScore >= 7) pros.push('日期落在週末或週五，時間安排友善');
  else if (dayScore <= 3) cons.push('平日活動，需要評估行程成本');
  if (placeScore >= 8) pros.push(`${place?.[0] || venue}交通便利`);
  else if (placeScore <= 2) cons.push('會場地點加分較少');
  if (priceInfo.score >= 8) pros.push(priceInfo.note);
  else if (priceInfo.score <= 2) cons.push(priceInfo.note);

  return { total, verdict, groups, groupScore, rareHits, rareScore, dayScore, placeScore, priceInfo, highRisk, recommendation, pros, cons };
}

function App() {
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [text, setText] = useState('');
  const [manualGroups, setManualGroups] = useState('');
  const [day, setDay] = useState('土');
  const [venue, setVenue] = useState('渋谷');
  const [price, setPrice] = useState('');
  const [ocrState, setOcrState] = useState({ status: 'idle', progress: 0 });
  const [ocrLog, setOcrLog] = useState(null);
  const result = useMemo(() => analyze({ text, manualGroups, day, venue, price }), [text, manualGroups, day, venue, price]);

  useEffect(() => () => image && URL.revokeObjectURL(image), [image]);

  function applyDetectedText(nextText) {
    const parsed = parsePosterText(nextText);
    setText(nextText);
    if (parsed.day) setDay(parsed.day);
    if (parsed.venue) setVenue(parsed.venue);
    if (parsed.price) setPrice(parsed.price);
  }

  function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    setImageFile(file);
    setOcrState({ status: 'ready', progress: 0 });
  }

  async function runOcr() {
    if (!imageFile) return;
    setOcrState({ status: 'loading', progress: 0 });
    try {
      const { text: nextText, log } = await recognizePoster('tesseract', imageFile, {
        onProgress: ({ status, progress = 0 }) => setOcrState({ status, progress }),
      });
      applyDetectedText(nextText);
      setOcrLog({ ...log, finishedAt: new Date().toISOString() });
      setOcrState({ status: 'done', progress: 1 });
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

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><b>TAIBAN AI</b></div>
        <span className="status"><i /> Personal scoring model</span>
      </header>

      <section className="hero">
        <p className="eyebrow">対バン AI 評分系統</p>
        <h1>海報丟進來，<br /><span>值不值得去一眼就知道。</span></h1>
        <p className="hero-copy">辨識出演名單、地點、日期與票價，依照你的偏好即時計算推薦度。</p>
      </section>

      <section className="workspace">
        <div className="input-column">
          <section className="glass upload-card">
            <div className="section-heading">
              <div><span className="step">01</span><h2>上傳活動海報</h2></div>
              {image && <span className="mini-status"><CheckCircle2 size={14} /> 已上傳</span>}
            </div>
            <label className={`dropzone ${image ? 'has-image' : ''}`}>
              {image
                ? <img src={image} alt="活動海報預覽" />
                : <div className="dropzone-empty"><span><ImagePlus size={26} /></span><b>選擇海報圖片</b><small>支援 JPG、PNG、WEBP</small></div>}
              <input type="file" accept="image/*" onChange={onFile} />
              {image && <span className="replace"><Upload size={14} /> 更換圖片</span>}
            </label>
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
                {ocrLog.openaiResponseStatus && <><dt>HTTP 狀態</dt><dd>{ocrLog.openaiResponseStatus}</dd></>}
                {ocrLog.textLength != null && <><dt>辨識文字長度</dt><dd>{ocrLog.textLength}</dd></>}
                {ocrLog.updatedAt && <><dt>最後更新</dt><dd>{new Date(ocrLog.updatedAt).toLocaleString()}</dd></>}
              </dl>
            </div>}
          </section>

          <section className="glass form-card">
            <div className="section-heading"><div><span className="step">02</span><h2>確認辨識內容</h2></div></div>
            <label className="field full"><span>海報文字 <small>可手動修正</small></span><textarea value={text} onChange={event => applyDetectedText(event.target.value)} placeholder="OCR 結果會顯示在這裡，也可以直接貼上海報文字。" /></label>
            <label className="field full"><span>手動補正團名 <small>一行一團，可直接貼上出演清單</small></span><textarea className="group-list" value={manualGroups} onChange={event => setManualGroups(event.target.value)} placeholder={'例如：\nMerry BAD TUNE\nMirror Mirror\nHIBANA'} /></label>
            <div className="form-grid">
              <label className="field"><span><CalendarDays size={15} /> 星期</span><select value={day} onChange={event => setDay(event.target.value)}>{['土', '日', '金', '月', '火', '水', '木'].map(value => <option key={value}>{value}</option>)}</select></label>
              <label className="field"><span><Ticket size={15} /> 票價</span><div className="suffix"><input type="number" value={price} onChange={event => setPrice(event.target.value)} placeholder="0" /><i>円</i></div></label>
              <label className="field full"><span><MapPin size={15} /> 會場 / 地區</span><input value={venue} onChange={event => setVenue(event.target.value)} placeholder="例如：渋谷" /></label>
            </div>
          </section>
        </div>

        <aside className="result-column">
          <section className="glass score-card">
            <div className="section-heading"><div><span className="step">03</span><h2>AI 評分結果</h2></div><span className="live"><i /> LIVE</span></div>
            <div className="score-ring" style={{ '--score': `${result.total * 3.6}deg` }}>
              <div><strong>{result.total}</strong><small>/ 100</small></div>
            </div>
            <div className="verdict"><span>{result.verdict}</span><p>{result.recommendation}</p></div>
            <div className={`risk ${result.highRisk ? 'risk-high' : ''}`}>
              <AlertTriangle size={17} /><div><small>爆死風險</small><b>{result.highRisk ? '高' : '普通'}</b></div>
            </div>
            <ul className="breakdown">
              <li><span><Star /> 團體價值</span><b>{result.groupScore}<small>/50</small></b></li>
              <li><span><Sparkles /> 稀有度</span><b>{result.rareScore}<small>/20</small></b></li>
              <li><span><CalendarDays /> 日期</span><b>{result.dayScore}<small>/10</small></b></li>
              <li><span><MapPin /> 地點</span><b>{result.placeScore}<small>/10</small></b></li>
              <li><span><Ticket /> 票價</span><b>{result.priceInfo.score}<small>/10</small></b></li>
            </ul>
          </section>
        </aside>
      </section>

      <section className="glass details">
        <div className="section-heading"><div><span className="step">04</span><h2>分析詳情</h2></div></div>
        <div className="details-grid">
          <div>
            <h3>出演團體</h3>
            {result.groups.length
              ? <div className="chips">{result.groups.map(group => <span className={`chip tier-${group.tier}`} key={group.name}><b>{group.tier}</b>{group.name}</span>)}</div>
              : <p className="muted">貼上海報文字或執行 OCR 後，出演團體會顯示在這裡。</p>}
          </div>
          <div className="insights">
            <div><h3><CheckCircle2 /> 優點</h3>{result.pros.length ? result.pros.map(item => <p key={item}>{item}</p>) : <p className="muted">尚無明顯優點</p>}</div>
            <div><h3><XCircle /> 注意事項</h3>{result.cons.length ? result.cons.map(item => <p key={item}>{item}</p>) : <p className="muted">沒有明顯缺點</p>}</div>
          </div>
        </div>
      </section>

      <footer><span>TAIBAN AI</span><small>Built for better live decisions <ChevronRight size={13} /></small></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
