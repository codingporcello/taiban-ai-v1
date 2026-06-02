# TAIBAN AI

対バン海報 OCR 與活動評分系統。免費版預設使用：

- `Tesseract OCR`：直接在瀏覽器執行。

目前免費版 UI 不會呼叫 OpenAI Vision API。辨識不完整或失敗時，可以直接貼上活動文字，或在「手動補正團名」欄位一行貼上一個團名。評分會即時更新。

## OpenAI Vision 設定

API key 只放在後端環境變數，不會送到瀏覽器。

1. 建立本機環境設定：

   ```bash
   cp .env.example .env
   ```

2. 編輯 `.env`：

   ```dotenv
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_VISION_MODEL=gpt-4.1-mini
   OPENAI_VISION_PORT=8787
   ```

`.env` 已列入 `.gitignore`，不要提交到版本控制。

## 免費版本機啟動

需要 Node.js 與 npm。開啟一個終端視窗：

```bash
npm run dev
```

接著開啟 Vite 顯示的網址，通常是：

```text
http://localhost:5173
```

## 免費版本機測試

1. 上傳一張活動海報。
2. 點擊 `開始 OCR 自動辨識`。
3. 若辨識不完整，直接修改海報文字，或在「手動補正團名」貼上出演清單。
4. 確認右側評分與下方出演團體即時更新。

## OpenAI Vision 保留介面

OpenAI Vision 後端介面仍保留供未來切換，但免費版 UI 不會呼叫它。

需要測試後端時，先啟動：

```bash
npm run api
```

先確認後端有讀取到 API key：

```bash
curl http://127.0.0.1:8787/api/health
```

成功時會回傳：

```json
{"ok":true,"openaiConfigured":true}
```

接著在畫面中：

1. 上傳一張活動海報。
2. 將 `OCR 引擎` 切換為 `OpenAI Vision`。
3. 點擊 `開始 OCR 自動辨識`。
4. 確認海報文字欄位出現辨識結果，日期、地點與票價會自動帶入。

也可以直接測試後端：

```bash
curl -X POST http://127.0.0.1:8787/api/ocr/openai-vision \
  -F "image=@/absolute/path/to/poster.jpg"
```

成功時會回傳：

```json
{"text":"海報上的文字"}
```

查詢最近一次 OpenAI Vision OCR log：

```bash
curl http://127.0.0.1:8787/api/ocr/logs/latest
```

回傳內容會標示 provider、是否已呼叫 OpenAI API、是否收到 OpenAI 回傳，以及辨識狀態。log 不會包含 API key 或圖片內容。

## 實作說明

後端位於 `server/vision-server.mjs`：

1. 接收前端上傳的圖片。
2. 將圖片轉換成 Base64 data URL。
3. 使用 `input_text` 與 `input_image` 呼叫 OpenAI Responses API。
4. 僅將 OCR 文字回傳給前端。

前端不會接觸 `OPENAI_API_KEY`。

## 官方文件

- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)
