import { CopilotClient, approveAll } from "@github/copilot-sdk";

// ─────────────────────────────────────────────────────────
// ストリーミングとは？
//
// 【STEP 1 の sendAndWait（非ストリーミング）】
//   LLM が全部考え終わる → まとめて返す → 表示される
//   体験: 数秒間無反応 → ドンッと全文表示
//
// 【STEP 2 のストリーミング】
//   LLM が生成しながら → 少しずつ送る → 即時表示
//   体験: 文字がリアルタイムで流れてくる
//
// 仕組み:
//   LLM はトークン（単語の断片）を1つずつ生成する
//   streaming: true にすると、生成されたトークンを
//   ためずに即座に "チャンク（断片）" として送信してくれる
//   → assistant.message_delta イベントで受け取る
// ─────────────────────────────────────────────────────────

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  onPermissionRequest: approveAll,
  streaming: true, // ① ストリーミングを有効化
});

// ② チャンク（断片）が届くたびに即時表示
//    message_delta = "メッセージの差分（delta）"
//    event.data.deltaContent にそのチャンクのテキストが入っている
//    process.stdout.write は console.log と違い、末尾に改行をつけないため
//    チャンクをつなげてシームレスに表示できる
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});

// ③ session.idle = "セッションがアイドル状態になった"
//    = LLM の処理が完了してすべてのチャンクを受信し終えた合図
session.on("session.idle", () => {
  console.log(); // 最後に改行を入れる
});

// ④ メッセージ送信（完了を待つ）
await session.sendAndWait({
  prompt:
    "JavaScriptの非同期処理について、初心者にわかりやすく説明してください",
});

await client.stop();
process.exit(0);
