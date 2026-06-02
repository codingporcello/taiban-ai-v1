const OPENAI_VISION_ENDPOINT = '/api/ocr/openai-vision';

export async function recognizeWithOpenAiVision(image, { onProgress } = {}) {
  onProgress?.({ status: 'uploading', progress: 0.15 });
  const formData = new FormData();
  formData.append('image', image);
  const response = await fetch(OPENAI_VISION_ENDPOINT, { method: 'POST', body: formData });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const messages = {
      OPENAI_API_KEY_MISSING: 'OpenAI Vision 尚未設定 API key，請先建立 .env。',
      IMAGE_REQUIRED: '請先選擇海報圖片。',
      UNSUPPORTED_IMAGE: 'OpenAI Vision 僅支援 JPG、PNG、WEBP 或 GIF 圖片。',
      IMAGE_TOO_LARGE: '圖片超過 50MB，請改用較小的檔案。',
    };
    const error = new Error(messages[data.error] || (response.status === 404
      ? 'OpenAI Vision 尚未連接後端服務。'
      : 'OpenAI Vision 辨識失敗，請稍後再試。'));
    error.log = data.log;
    throw error;
  }

  onProgress?.({ status: 'analyzing', progress: 0.75 });
  const data = await response.json();
  if (!data.text) throw new Error('OpenAI Vision 沒有回傳可用文字。');
  return { text: data.text.trim(), log: data.log };
}
