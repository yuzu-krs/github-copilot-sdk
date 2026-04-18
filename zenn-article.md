---
title: "GitHub Copilot SDK 完全入門 ― 7ステップで自分だけのAIエージェントを作る"
emoji: "🤖"
type: "tech"
topics: ["githubcopilot", "typescript", "ai", "mcp", "sdk"]
published: false
---

## はじめに

GitHub Copilot SDK は、**Copilot CLI のエージェントランタイム**をプログラムから呼び出せる SDK です。Copilot が内部で使っているのと同じエンジンを、自分のアプリケーションに組み込めます。

この記事では、7つのステップを通じて SDK の基本から応用までをハンズオン形式で解説します。

:::message
この記事は **2026年4月時点（Public Preview）** の情報に基づいています。APIは今後変更される可能性があります。
:::

**この記事で作るもの:**

- LLM へのプロンプト送信とレスポンス受信
- ストリーミング出力
- カスタムツール（Function Calling）
- 対話型アシスタント
- カスタムエージェント
- MCP サーバー連携
- BYOK（自分のAPIキーで動かす）

**対応言語:**

| 言語                 | パッケージ名                       | インストール                              |
| -------------------- | ---------------------------------- | ----------------------------------------- |
| Node.js / TypeScript | `@github/copilot-sdk`              | `npm install @github/copilot-sdk`         |
| Python               | `github-copilot-sdk`               | `pip install github-copilot-sdk`          |
| Go                   | `github.com/github/copilot-sdk/go` | `go get github.com/github/copilot-sdk/go` |
| .NET                 | `GitHub.Copilot.SDK`               | `dotnet add package GitHub.Copilot.SDK`   |
| Java                 | `com.github:copilot-sdk-java`      | Maven / Gradle                            |

本記事では **Node.js / TypeScript** を使用します。

**アーキテクチャ:**

```
あなたのアプリケーション
       ↓
   SDK Client
       ↓ JSON-RPC
   Copilot CLI (server mode)
```

SDK は CLI プロセスのライフサイクルを自動管理します。Node.js / Python / .NET では CLI がバンドルされているため、別途インストール不要です。

:::message alert
GitHub Copilot のサブスクリプション（Free プラン含む）が必要です。各プロンプトはプレミアムリクエストのクォータに計上されます。BYOK を使えば GitHub 認証なしでも利用可能です。
:::

## 環境構築

### 前提条件

- **Node.js 18 以上**
- **GitHub Copilot のサブスクリプション**（Free プランでも可）
- **GitHub CLI** または **Copilot CLI** がインストール済みで認証済み

### Copilot CLI の認証確認

```bash
# Copilot CLI のバージョン確認
copilot --version
```

Node.js SDK では Copilot CLI がバンドルされているため別途インストールは不要ですが、**認証（ログイン）は事前に済ませておく**必要があります。

### プロジェクトの作成

```bash
# プロジェクトディレクトリ作成
mkdir copilot-sdk-handson && cd copilot-sdk-handson

# npm プロジェクト初期化（ESM モジュール形式）
npm init -y --init-type module

# SDK と TypeScript ランナーをインストール
npm install @github/copilot-sdk tsx
```

### 動作確認

```bash
node -v
# v18.0.0 以上であること

ls node_modules/@github/copilot-sdk
```

---

## STEP 1: 最初のメッセージを送る

まずは最もシンプルな例から。LLM にプロンプトを送り、レスポンスを受け取ります。

**ポイント:**

- `CopilotClient` が CLI サーバーのライフサイクルを管理
- `createSession()` でセッションを作成し、モデルを指定
- `sendAndWait()` でプロンプトを送り、レスポンスを待つ
- `onPermissionRequest` はツール実行時の許可ハンドラ（必須）

```typescript:step1-hello.ts
import { CopilotClient, approveAll } from "@github/copilot-sdk";

// クライアントを作成（CLI プロセスを自動起動）
const client = new CopilotClient();

// セッションを作成
const session = await client.createSession({
  model: "gpt-4.1",
  onPermissionRequest: approveAll, // 必須：ツール実行の許可ハンドラ
});

// メッセージを送信して完了を待つ
const response = await session.sendAndWait({
  prompt: "TypeScriptの型システムの特徴を3つ教えてください",
});

// レスポンスを表示
console.log(response?.data.content);

// クリーンアップ
await client.stop();
process.exit(0);
```

```bash
npx tsx step1-hello.ts
```

:::details 期待される出力

```
TypeScriptの型システムの主な特徴を3つご紹介します：

1. **構造的型付け（Structural Typing）**: ...
2. **型推論（Type Inference）**: ...
3. **ジェネリクス（Generics）**: ...
```

:::

たったこれだけで Copilot の LLM を自分のコードから呼び出せました。初回起動時は CLI サーバーの起動に少し時間がかかります。

---

## STEP 2: ストリーミングレスポンス

STEP 1 ではレスポンス全体を待ってから表示しました。次はストリーミングでリアルタイムに文字を表示します。

**ポイント:**

- `streaming: true` でストリーミングを有効化
- `assistant.message_delta` イベントでチャンク（断片）を受信
- `session.idle` イベントで処理完了を検知

```typescript:step2-streaming.ts
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true, // ストリーミングを有効化
});

// ストリーミングチャンクをリアルタイム表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});

// 処理完了時
session.on("session.idle", () => {
  console.log(); // 改行
});

// メッセージ送信
await session.sendAndWait({
  prompt:
    "JavaScriptの非同期処理について、初心者にわかりやすく説明してください",
});

await client.stop();
process.exit(0);
```

```bash
npx tsx step2-streaming.ts
```

STEP 1 の一括表示と比べると、文字がリアルタイムに流れてくる体験の違いがわかります。ChatGPT のようなインタラクティブなUIを作る場合はストリーミングが必須です。

---

## STEP 3: カスタムツールを定義する

ここからが本番です。**カスタムツール = Function Calling** は、LLM が「この情報が必要だ」と判断したときに、あなたが定義した関数を自動で呼び出す仕組みです。

**ポイント:**

- `defineTool()` でツールを定義（名前、説明、パラメータスキーマ、ハンドラ）
- LLM は説明文を見てツールの使用を判断する
- ハンドラは JSON シリアライズ可能な値を返す
- `approveAll` で全ツール実行を自動承認

```typescript:step3-custom-tool.ts
import { CopilotClient, defineTool, approveAll } from "@github/copilot-sdk";

// カスタムツールを定義: 天気情報の取得
const getWeather = defineTool("get_weather", {
  description: "指定された都市の現在の天気を取得します",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "都市名（例: Tokyo, Seattle）",
      },
    },
    required: ["city"],
  },
  handler: async (args: { city: string }) => {
    // 実際のアプリでは天気 API を呼び出す
    const weatherData: Record<string, { temp: number; condition: string }> = {
      Tokyo: { temp: 22, condition: "晴れ" },
      Osaka: { temp: 24, condition: "曇り" },
      Seattle: { temp: 15, condition: "雨" },
      London: { temp: 12, condition: "霧" },
    };

    const data = weatherData[args.city];
    if (data) {
      return {
        city: args.city,
        temperature: `${data.temp}°C`,
        condition: data.condition,
      };
    }
    return { city: args.city, error: "データが見つかりません" };
  },
});

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
  tools: [getWeather], // ツールを登録
  onPermissionRequest: approveAll, // 全ツール実行を自動承認
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});

// ツール実行の開始/完了をログ表示
session.on("tool.execution_start", (event) => {
  console.log(`\n🔧 ツール実行開始: ${event.data.toolName}`);
});

session.on("tool.execution_complete", (event) => {
  console.log(`✅ ツール実行完了: ${event.data.toolName}\n`);
});

session.on("session.idle", () => {
  console.log();
});

// 東京とシアトルの天気を聞く（ツールが2回呼ばれるはず）
await session.sendAndWait({
  prompt: "東京とシアトルの天気を比較してください",
});

await client.stop();
process.exit(0);
```

```bash
npx tsx step3-custom-tool.ts
```

:::details 期待される出力

```
🔧 ツール実行開始: get_weather
✅ ツール実行完了: get_weather

🔧 ツール実行開始: get_weather
✅ ツール実行完了: get_weather

東京とシアトルの天気を比較します：

| 都市 | 気温 | 天気 |
|------|------|------|
| 東京 | 22°C | 晴れ |
| シアトル | 15°C | 雨 |

東京のほうが暖かく、晴れていますね！...
```

:::

注目すべきは、**プロンプトに「ツールを使え」とは一切書いていない**点です。LLM が「天気の比較には天気データが必要」と自律的に判断し、`get_weather` を 2回呼び出しています。

---

## STEP 4: 対話型アシスタントを作る

ここまでは1回のやり取りで終了していましたが、次は会話を継続できる対話型アシスタントを作ります。

**ポイント:**

- `readline` で対話ループを作成
- セッションはステートフル（会話の文脈を保持）
- `systemMessage` でアシスタントのキャラクターを設定

```typescript:step4-interactive.ts
import { CopilotClient, defineTool, approveAll } from "@github/copilot-sdk";
import * as readline from "readline";

// ツール定義: 今日の日付を返す
const getDate = defineTool("get_current_date", {
  description: "現在の日付と時刻を返します",
  parameters: { type: "object", properties: {} },
  handler: async () => {
    return { datetime: new Date().toLocaleString("ja-JP") };
  },
});

// ツール定義: 簡易計算
const calculate = defineTool("calculate", {
  description: "数式を計算します",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "計算する数式（例: 2 + 3 * 4）",
      },
    },
    required: ["expression"],
  },
  handler: async (args: { expression: string }) => {
    // 安全な数式評価（数字と演算子のみ許可）
    const sanitized = args.expression.replace(/[^0-9+\-*/().%\s]/g, "");
    if (sanitized !== args.expression) {
      return { error: "無効な文字が含まれています" };
    }
    const result = Function(`"use strict"; return (${sanitized})`)();
    return { expression: args.expression, result };
  },
});

// クライアント＆セッション作成
const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
  tools: [getDate, calculate],
  onPermissionRequest: approveAll,
  systemMessage: {
    content: `あなたは親切な日本語アシスタントです。
簡潔で分かりやすい回答を心がけてください。`,
  },
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});

// readline インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  🤖 Copilot アシスタント");
console.log("  利用可能なツール: 日付取得、計算");
console.log("  終了するには 'exit' と入力");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log();

const promptUser = () => {
  rl.question("あなた: ", async (input) => {
    const trimmed = input.trim();

    if (trimmed.toLowerCase() === "exit") {
      console.log("\n👋 さようなら！");
      await client.stop();
      rl.close();
      return;
    }

    if (!trimmed) {
      promptUser();
      return;
    }

    process.stdout.write("\nCopilot: ");
    await session.sendAndWait({ prompt: trimmed });
    console.log("\n");
    promptUser();
  });
};

promptUser();
```

```bash
npx tsx step4-interactive.ts
```

:::details 動作例

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🤖 Copilot アシスタント
  利用可能なツール: 日付取得、計算
  終了するには 'exit' と入力
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

あなた: 今日は何日？

Copilot: 現在の日時は2026年4月18日 14:32:05です。

あなた: 消費税10%込みで、3980円の商品の合計金額は？

Copilot: 3,980円の消費税10%込みの合計金額は **4,378円** です。

あなた: exit

👋 さようなら！
```

:::

セッションがステートフルなので、前の会話の文脈を踏まえた回答が可能です。「さっきの計算結果を2倍にして」のように、文脈を参照する質問も正しく処理されます。

---

## STEP 5: カスタムエージェントを定義する

カスタムエージェントを使うと、**特定の役割を持つ AI ペルソナ**を定義できます。ここではコードレビュー専門のエージェントを作ります。

**ポイント:**

- `customAgents` でエージェントを定義
- `agent` で最初から特定のエージェントを選択可能
- `prompt` でエージェントの振る舞いを細かく指定

```typescript:step5-custom-agent.ts
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
  onPermissionRequest: approveAll,

  // カスタムエージェントを定義
  customAgents: [
    {
      name: "code-reviewer",
      displayName: "コードレビュアー",
      description:
        "コードレビューの専門家。セキュリティ、パフォーマンス、可読性を重視",
      prompt: `あなたは経験豊富なシニアエンジニアのコードレビュアーです。
以下の観点でレビューしてください：
1. セキュリティ上の問題
2. パフォーマンスの問題
3. 可読性・保守性
4. ベストプラクティスからの逸脱
各問題には重要度（🔴 高 / 🟡 中 / 🟢 低）をつけてください。`,
    },
  ],

  // このエージェントを最初から選択
  agent: "code-reviewer",
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});
session.on("session.idle", () => console.log());

// レビュー対象のコード
const codeToReview = `
function getUserData(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  const result = db.query(query);
  const password = result.password;
  console.log("User password: " + password);
  return result;
}

app.get("/api/user/:id", (req, res) => {
  const data = getUserData(req.params.id);
  res.json(data);
});
`;

await session.sendAndWait({
  prompt: `以下のコードをレビューしてください：\n\`\`\`javascript${codeToReview}\`\`\``,
});

await client.stop();
process.exit(0);
```

```bash
npx tsx step5-custom-agent.ts
```

:::details 期待される出力例

```
## コードレビュー結果

### 🔴 高: SQLインジェクション脆弱性
`getUserData` でユーザー入力を直接SQL文に結合しています...

### 🔴 高: パスワードの平文ログ出力
`console.log("User password: " + password)` で機密情報をログに出力...

### 🟡 中: SELECT * の使用
必要なカラムのみを指定すべきです...

### 🟡 中: エラーハンドリングの欠如
データベースクエリのエラーハンドリングがありません...
```

:::

わざと脆弱性のあるコードを渡していますが、SQLインジェクション・パスワードのログ出力などをしっかり検出しています。`prompt` を調整すれば、自社のコーディング規約に沿ったレビュアーも作れます。

---

## STEP 6: MCP サーバーと連携する

**MCP（Model Context Protocol）** は、外部ツールを標準プロトコルで LLM に接続する仕組みです。GitHub が提供する MCP サーバーを使えば、リポジトリ・Issue・PR の情報にプログラムからアクセスできます。

```typescript:step6-mcp.ts
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
  onPermissionRequest: approveAll,

  // GitHub MCP サーバーに接続
  mcpServers: {
    github: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
    },
  },
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});
session.on("session.idle", () => console.log());

// GitHub のリポジトリ情報を聞いてみる
await session.sendAndWait({
  prompt:
    "github/copilot-sdk リポジトリの最新のリリースバージョンと、直近のIssueを3件教えてください",
});

await client.stop();
process.exit(0);
```

```bash
npx tsx step6-mcp.ts
```

`mcpServers` にサーバー情報を渡すだけで接続完了です。GitHub MCP サーバー以外にも、MCP プロトコルに対応した任意のサーバー（データベース、社内API など）を接続できます。

---

## STEP 7: BYOK（自分のAPIキーを使う）

**BYOK = Bring Your Own Key** を使えば、GitHub 認証なしで自分の API キーを使って LLM にアクセスできます。OpenAI、Azure OpenAI、Anthropic、Ollama（ローカル）に対応しています。

```typescript:step7-byok.ts
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const client = new CopilotClient();

// --- パターン A: OpenAI API を使う場合 ---
const sessionOpenAI = await client.createSession({
  model: "gpt-4o", // カスタムプロバイダーでは model 指定が必須
  onPermissionRequest: approveAll,
  provider: {
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// --- パターン B: Ollama（ローカルLLM）を使う場合 ---
// const sessionOllama = await client.createSession({
//   model: "deepseek-coder-v2:16b",
//   onPermissionRequest: approveAll,
//   provider: {
//     type: "openai",
//     baseUrl: "http://localhost:11434/v1",
//     // Ollama は apiKey 不要
//   },
// });

// --- パターン C: Azure OpenAI を使う場合 ---
// const sessionAzure = await client.createSession({
//   model: "gpt-4",
//   onPermissionRequest: approveAll,
//   provider: {
//     type: "azure",  // Azure の場合は "azure" を指定（"openai" ではない）
//     baseUrl: "https://my-resource.openai.azure.com",
//     apiKey: process.env.AZURE_OPENAI_KEY,
//     azure: { apiVersion: "2024-10-21" },
//   },
// });

const response = await sessionOpenAI.sendAndWait({
  prompt: "Hello! 日本語で自己紹介してください。",
});

console.log(response?.data.content);

await client.stop();
process.exit(0);
```

```bash
# 環境変数にAPIキーを設定
export OPENAI_API_KEY="sk-..."

npx tsx step7-byok.ts
```

Ollama を使えばローカル環境だけで完結し、外部への通信なしに SDK の機能をフル活用できます。

---

## まとめ

| STEP | 内容                 | キーワード                                      |
| ---- | -------------------- | ----------------------------------------------- |
| 1    | 最初のメッセージ送信 | `CopilotClient`, `createSession`, `sendAndWait` |
| 2    | ストリーミング       | `streaming: true`, `message_delta`              |
| 3    | カスタムツール       | `defineTool`, `handler`, `approveAll`           |
| 4    | 対話型アシスタント   | `readline`, `systemMessage`, 会話の文脈保持     |
| 5    | カスタムエージェント | `customAgents`, `agent`, AI ペルソナ            |
| 6    | MCP サーバー連携     | `mcpServers`, Model Context Protocol            |
| 7    | BYOK                 | `provider`, OpenAI / Azure / Ollama             |

## さらに探求するトピック

- **Permission Handling**: `onPermissionRequest` でツール実行を細かく制御
- **Session Hooks**: `onPreToolUse`, `onPostToolUse` でツール実行前後にロジックを挿入
- **Infinite Sessions**: 長時間セッションでのコンテキスト自動圧縮
- **User Input Requests**: `onUserInputRequest` でエージェントからユーザーへの質問を実装
- **UI Elicitation**: `session.ui.confirm()`, `session.ui.select()` でフォームベースのUI
- **OpenTelemetry**: テレメトリ設定で分散トレーシング
- **File Attachments**: 画像ファイルの添付と分析

## トラブルシューティング

| エラー                       | 原因                         | 対処                                          |
| ---------------------------- | ---------------------------- | --------------------------------------------- |
| `COPILOT_CLI_PATH not found` | CLI が見つからない           | `npm install` をやり直す                      |
| `Authentication failed`      | 認証が通っていない           | `copilot auth login` で再認証                 |
| `Model not available`        | 指定モデルが利用不可         | `listModels()` で利用可能モデルを確認         |
| `Permission denied`          | ツール実行が拒否された       | `onPermissionRequest: approveAll` を設定      |
| `Timeout`                    | レスポンスが時間内に返らない | `sendAndWait` の `timeout` パラメータを増やす |

:::details 環境変数の設定

```bash
# GitHub トークン（認証用）
export COPILOT_GITHUB_TOKEN="ghp_..."
# または
export GH_TOKEN="ghp_..."
export GITHUB_TOKEN="ghp_..."

# BYOK 用
export OPENAI_API_KEY="sk-..."
export AZURE_OPENAI_KEY="..."
```

:::

## 参考リンク

- [GitHub Copilot SDK リポジトリ](https://github.com/github/copilot-sdk)
- [Getting Started ガイド](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- [Node.js SDK リファレンス](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md)
- [認証ガイド](https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md)
- [BYOK ドキュメント](https://github.com/github/copilot-sdk/blob/main/docs/auth/byok.md)
- [MCP サーバー連携](https://github.com/github/copilot-sdk/blob/main/docs/features/mcp.md)
- [カスタムエージェント](https://github.com/github/copilot-sdk/blob/main/docs/features/custom-agents.md)
- [Cookbook（レシピ集）](https://github.com/github/awesome-copilot/blob/main/cookbook/copilot-sdk)
