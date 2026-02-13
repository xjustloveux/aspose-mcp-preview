# aspose-mcp-preview

[![Release](https://github.com/xjustloveux/aspose-mcp-preview/actions/workflows/release.yml/badge.svg)](https://github.com/xjustloveux/aspose-mcp-preview/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/aspose-mcp-preview.svg)](https://www.npmjs.com/package/aspose-mcp-preview)
[![Socket Badge](https://socket.dev/api/badge/npm/package/aspose-mcp-preview)](https://socket.dev/npm/package/aspose-mcp-preview)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

[aspose-mcp-server](https://github.com/xjustloveux/aspose-mcp-server) 的即時文件預覽擴充套件。

當 MCP 用戶端透過 aspose-mcp-server 編輯文件時，此擴充套件會在瀏覽器中顯示 PNG、HTML 或 PDF 預覽，提供即時的視覺回饋。

![Demo](https://github.com/user-attachments/assets/8093e281-059e-47d3-b356-5578e3284658)

## 功能特色

- 透過 WebSocket 即時更新預覽
- 支援多種文件類型（Word、Excel、PowerPoint、PDF）
- 多種輸出格式（PNG、HTML、PDF）
- 多工作階段支援，可切換工作階段
- 縮放控制（自適應、100%、自訂百分比）
- PDF 分頁導覽
- 淺色/深色/系統主題支援
- 可收合的日誌面板，方便除錯
- 響應式設計（桌面側邊欄、行動裝置友善）

## 系統需求

- Node.js >= 20
- 支援擴充套件的 aspose-mcp-server

## 使用方式

在 aspose-mcp-server 的 `extensions.json` 中設定擴充套件：

```json
{
  "schemaVersion": "1.0",
  "extensions": {
    "aspose-mcp-preview": {
      "command": {
        "type": "npx",
        "executable": "aspose-mcp-preview@latest",
        "arguments": ""
      },
      "inputFormats": ["png", "html", "pdf"],
      "supportedDocumentTypes": ["word", "excel", "powerpoint", "pdf"],
      "transportModes": ["stdin", "file", "mmap"],
      "preferredTransportMode": "stdin",
      "protocolVersion": "1.0",
      "capabilities": {
        "supportsHeartbeat": true,
        "frameIntervalMs": 100,
        "snapshotTtlSeconds": 30,
        "maxMissedHeartbeats": 3,
        "idleTimeoutMinutes": 30
      }
    }
  }
}
```

> **提示：** `@latest` 會在每次啟動時檢查並使用最新版本。若要固定版本以確保穩定性，可改為 `aspose-mcp-preview@1.0.0`（指定版本號）。

## 選項

可透過 `extensions.json` 的 `arguments` 欄位或環境變數設定：

| 選項 | 環境變數 | 預設值 | 說明 |
|------|----------|--------|------|
| `--port, -p` | `ASPOSE_PREVIEW_PORT` | `3000` | HTTP 伺服器連接埠 |
| `--host, -h` | `ASPOSE_PREVIEW_HOST` | `localhost` | 綁定主機 |
| `--no-open` | `ASPOSE_PREVIEW_NO_OPEN` | `false` | 停用自動開啟瀏覽器 |
| `--transport` | `ASPOSE_PREVIEW_TRANSPORT` | `stdin` | 傳輸模式（stdin/file/mmap） |

範例：
```json
"executable": "aspose-mcp-preview@latest",
"arguments": "--port 8080 --no-open"
```

主題和除錯設定可透過網頁介面設定。

### 傳輸模式

| 模式 | 說明 | 平台支援 |
|------|------|----------|
| `stdin` | 透過標準輸入傳輸二進位資料 | 全平台 |
| `file` | 透過暫存檔案傳輸 | 全平台 |
| `mmap` | 透過共享記憶體傳輸（高效能） | Windows/Linux/macOS |

> **注意：** Windows 的 mmap 使用 `koffi` 套件呼叫 Windows API（已包含在依賴中）。Linux 和 macOS 無需額外套件。

## 授權

MIT 授權 - 詳見 [LICENSE](LICENSE) 檔案。

---

# 開發者文件

以下內容適用於想要了解內部實作的開發者。

## 開發環境

```bash
# 複製並安裝
git clone https://github.com/xjustloveux/aspose-mcp-preview.git
cd aspose-mcp-preview
npm install

# 以開發模式執行
npm run dev

# 程式碼品質檢查
npm run lint          # 檢查程式碼規範
npm run lint:fix      # 自動修復規範問題
npm run format        # 格式化程式碼
npm run format:check  # 檢查格式
npm run code-quality  # 執行格式化和規範修復
```

## 通訊協定

aspose-mcp-preview 使用三層協定與 aspose-mcp-server 通訊：

1. **JSON 元資料行** - 訊息類型和參數
2. **8 位元組長度前綴** - Little-endian int64（僅限 stdin 傳輸）
3. **二進位資料** - PNG/HTML/PDF 內容

### 握手協議

擴充套件啟動時會進行三階段握手：

```
aspose-mcp-server                    aspose-mcp-preview
       │                                    │
       │  { "type": "initialize",           │
       │    "protocolVersion": "1.0" }      │
       │───────────────────────────────────>│
       │                                    │
       │  { "type": "initialize_response",  │
       │    "name": "aspose-mcp-preview",   │
       │    "version": "1.0.0", ... }       │
       │<───────────────────────────────────│
       │                                    │
       │  { "type": "initialized" }         │
       │───────────────────────────────────>│
       │                                    │
       │        握手完成，開始正常運作        │
```

### 訊息類型

| 類型 | 方向 | 說明 |
|------|------|------|
| `initialize` | 伺服器→擴充 | 握手初始化 |
| `initialize_response` | 擴充→伺服器 | 握手回應 |
| `initialized` | 伺服器→擴充 | 握手完成 |
| `snapshot` | 伺服器→擴充 | 文件預覽快照 |
| `heartbeat` | 伺服器→擴充 | 保持連線信號 |
| `session_closed` | 伺服器→擴充 | 工作階段已終止 |
| `shutdown` | 伺服器→擴充 | 伺服器正在關閉 |
| `ack` | 擴充→伺服器 | 確認回應 |
| `pong` | 擴充→伺服器 | 心跳回應 |

### ACK 回應

```json
{
  "type": "ack",
  "sequenceNumber": 12345,
  "status": "processed"
}
```

## API

### REST 端點

| 端點 | 說明 |
|------|------|
| `GET /api/sessions` | 列出所有作用中的工作階段 |
| `GET /api/sessions/:id/snapshot` | 取得快照二進位資料 |
| `GET /api/sessions/:id/info` | 取得工作階段元資料 |
| `POST /api/sessions/:id/viewed` | 標記工作階段為已檢視 |
| `GET /api/health` | 健康檢查 |

### WebSocket

連線至 `/ws` 以接收即時更新：

```javascript
// 伺服器 -> 用戶端訊息
{ "type": "snapshot", "sessionId": "...", "documentType": "word", "outputFormat": "png" }
{ "type": "session_closed", "sessionId": "..." }
{ "type": "shutdown" }
{ "type": "log", "level": "info", "category": "protocol", "message": "..." }
```
