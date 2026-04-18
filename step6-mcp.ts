import { CopilotClient, approveAll } from "@github/copilot-sdk";

// ─────────────────────────────────────────────────────────
// MCP（Model Context Protocol）とは？
//
// AI がリアルタイムの外部情報にアクセスするための標準プロトコル。
//
// ┌─────────────────────────────────────────────────┐
// │  STEP 3 のカスタムツール（defineTool）との違い   │
// │                                                  │
// │  defineTool … 自分でコードを書いてツールを作る   │
// │  MCP        … 既存のサービスを「そのまま」接続   │
// │                （コードを書かなくていい）         │
// └─────────────────────────────────────────────────┘
//
// 今回使う GitHub MCP サーバー:
//   URL: https://api.githubcopilot.com/mcp/
//   できること: リポジトリ情報・Issue・PR・コード検索など
//
// 仕組み:
//   1. セッション作成時に MCP サーバーの URL を渡す
//   2. SDK がセッション開始時に MCP サーバーへ接続
//   3. LLM が必要に応じて MCP サーバーのツールを自動で呼び出す
//   4. 取得したリアルタイムデータを踏まえて回答を生成
// ─────────────────────────────────────────────────────────

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
  onPermissionRequest: approveAll,

  // mcpServers: 接続する MCP サーバーをキー名付きで指定
  // 複数のサーバーを同時に接続することもできる
  mcpServers: {
    github: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      // GitHub MCP は gh auth login の認証を自動で使う
    },
  },
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});
session.on("session.idle", () => console.log());

// MCP を通じて GitHub のリアルタイム情報を取得
// → LLM が github MCP サーバーのツールを自動で呼び出す
await session.sendAndWait({
  prompt:
    "microsoft/vscode リポジトリの最新のリリースバージョンと、直近のIssueを3件教えてください",
});

await client.stop();
process.exit(0);
