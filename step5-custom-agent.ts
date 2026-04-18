import { CopilotClient, approveAll } from "@github/copilot-sdk";

// ─────────────────────────────────────────────────────────
// カスタムエージェントとは？
//
// 「役割」と「人格」を持った AI ペルソナを定義できる仕組み。
//
// systemMessage との違い:
//   systemMessage  … セッション全体に適用される指示
//   customAgents   … 名前・説明付きの再利用可能なペルソナ
//                    → 複数定義して切り替えることもできる
//
// 使いどころ:
//   - コードレビュアー、セキュリティ診断、ドキュメント生成など
//     特化した役割を持つエージェントをアプリに組み込む
// ─────────────────────────────────────────────────────────

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
  onPermissionRequest: approveAll,

  // customAgents: 1つ以上のエージェントを定義できる
  customAgents: [
    {
      name: "code-reviewer", // 内部ID（agent: で指定するキー）
      displayName: "コードレビュアー", // 表示名
      description:
        "コードレビューの専門家。セキュリティ、パフォーマンス、可読性を重視",

      // prompt: このエージェントの「人格・役割」を定義する
      // systemMessage のようにすべての回答の前提になる
      prompt: `あなたは経験豊富なシニアエンジニアのコードレビュアーです。
以下の観点でレビューしてください：
1. セキュリティ上の問題
2. パフォーマンスの問題
3. 可読性・保守性
4. ベストプラクティスからの逸脱
各問題には重要度（🔴 高 / 🟡 中 / 🟢 低）をつけてください。`,
    },
  ],

  // agent: どのエージェントを使うか名前で指定
  // 省略するとデフォルト（通常の Copilot）が使われる
  agent: "code-reviewer",
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});
session.on("session.idle", () => console.log());

// ─────────────────────────────────────────────────────────
// レビュー対象コード（意図的に問題を含んでいる）
//
// 含まれる問題:
//   🔴 SQLインジェクション: ユーザー入力を直接 SQL に結合
//   🔴 パスワードの平文ログ出力
//   🟡 SELECT * の使用
//   🟡 エラーハンドリングなし
// ─────────────────────────────────────────────────────────
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

console.log("🔍 コードレビュー開始...\n");

await session.sendAndWait({
  prompt: `以下のコードをレビューしてください：\n\`\`\`javascript${codeToReview}\`\`\``,
});

await client.stop();
process.exit(0);
