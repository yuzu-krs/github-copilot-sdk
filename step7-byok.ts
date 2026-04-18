import { CopilotClient, approveAll } from "@github/copilot-sdk";

// ─────────────────────────────────────────────────────────
// BYOK（Bring Your Own Key）とは？
//
// 通常の Copilot SDK は GitHub 認証（gh auth login）を使って
// GitHub の LLM エンジンにアクセスする。
//
// BYOK では「自分の API キー」を使って
// OpenAI・Azure・Anthropic・Ollama など好きな LLM に接続できる。
//
// メリット:
//   - GitHub Copilot サブスクリプション不要
//   - 自社の Azure OpenAI エンドポイントを使える
//   - Ollama でローカル LLM を使える（コスト0）
//   - モデルを自由に選べる
//
// provider フィールドで切り替えるだけ。他のコードは変わらない。
// ─────────────────────────────────────────────────────────

const client = new CopilotClient();

// ─── パターン A: OpenAI API ───────────────────────────────
// 環境変数: OPENAI_API_KEY
const session = await client.createSession({
  model: "gpt-4o", // カスタムプロバイダー使用時は model 必須
  onPermissionRequest: approveAll,
  provider: {
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// ─── パターン B: Ollama（ローカル LLM）─────────────────────
// Ollama を起動しておく: ollama run llama3.2
// const session = await client.createSession({
//   model: "llama3.2",
//   onPermissionRequest: approveAll,
//   provider: {
//     type: "openai",                    // Ollama は OpenAI 互換 API
//     baseUrl: "http://localhost:11434/v1",
//     // apiKey 不要
//   },
// });

// ─── パターン C: Azure OpenAI ───────────────────────────────
// 環境変数: AZURE_OPENAI_KEY
// const session = await client.createSession({
//   model: "gpt-4",
//   onPermissionRequest: approveAll,
//   provider: {
//     type: "azure",                     // Azure は "openai" ではなく "azure"
//     baseUrl: "https://my-resource.openai.azure.com",
//     apiKey: process.env.AZURE_OPENAI_KEY,
//     azure: { apiVersion: "2024-10-21" },
//   },
// });

// ─── パターン D: Anthropic Claude ───────────────────────────
// 環境変数: ANTHROPIC_API_KEY
// const session = await client.createSession({
//   model: "claude-3-5-sonnet-20241022",
//   onPermissionRequest: approveAll,
//   provider: {
//     type: "anthropic",
//     apiKey: process.env.ANTHROPIC_API_KEY,
//   },
// });

// ─────────────────────────────────────────────────────────
// 以降は STEP 1 と全く同じコード。
// provider を変えるだけで、LLM を差し替えられる。
// ─────────────────────────────────────────────────────────

const response = await session.sendAndWait({
  prompt:
    "こんにちは！あなたは何者ですか？日本語で簡潔に自己紹介してください。",
});

console.log(response?.data.content);

await client.stop();
process.exit(0);
