import { recognizeWithTesseract } from './tesseract.js';

export const OCR_PROVIDERS = {
  tesseract: { label: 'Tesseract OCR', recognize: recognizeWithTesseract },
};

export async function recognizePoster(providerId, image, options) {
  const provider = OCR_PROVIDERS[providerId];
  if (!provider) throw new Error(`未知的 OCR provider：${providerId}`);
  return provider.recognize(image, options);
}
