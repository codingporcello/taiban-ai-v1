const TESSERACT_SCRIPT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tesseract]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Tesseract), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TESSERACT_SCRIPT;
    script.dataset.tesseract = 'true';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('無法載入 Tesseract OCR，請檢查網路連線。'));
    document.head.appendChild(script);
  });
}

export async function recognizeWithTesseract(image, { onProgress } = {}) {
  const Tesseract = await loadTesseract();
  const { data } = await Tesseract.recognize(image, 'jpn+eng', {
    logger: ({ status, progress = 0 }) => onProgress?.({ status, progress }),
  });
  const text = data.text.trim();
  return {
    text,
    log: {
      provider: 'Tesseract OCR',
      status: 'success',
      openaiApiCalled: false,
      openaiResponseReceived: false,
      textLength: text.length,
    },
  };
}
