# Zenn 記事草稿

タイトル：Claude Code の設定一式を DeepSeek Harness に 1 コマンドで引っ越す dsh-movein を作った

本文：

DeepSeek Harness (DSH) が公開されて 3 日、Claude Code から試しに乗り換える人が増えています。ツール自体は替えられても、積み上げた設定は簡単に持っていけません。CLAUDE.md のルール、SKILL.md の山、MCP サーバー、hooks、サブエージェント、権限ルール。これを 1 コマンドで丸ごと運ぶ dsh-movein を作りました。

![demo](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif)

```sh
npx dsh-movein            # ドライラン、引っ越し見積もりを表示
npx dsh-movein --apply    # 実際に引っ越す
```

## 何が運べるか

- プロジェクトの CLAUDE.md は運ぶ必要なし。DSH は CLAUDE.md をネイティブに読みます
- グローバル ~/.claude/CLAUDE.md は ~/.dsh/AGENTS.md にリンク
- スキルは DSH のスキルルートへシンボリックリンク。SKILL.md はそのまま互換
- .mcp.json は dsh-mcp-client の設定行へ機械変換。ツール名 mcp__server__tool は両者で完全一致
- hooks は公式ブリッジ dsh-hooks-claude-code が既存設定をそのまま実行
- サブエージェントは DSH スキルに変換、システムプロンプトがスキル本文になります
- 権限ルールの deny と ask は同梱プラグインが tools/pre-execute ゲートで強制

セッション履歴は対象外です。会話の移行は dsh-chat-import が良くできているので併用してください。

## ハマった 3 点

1. profile から解決できないパッケージを cordis.patch.yml に書くと dsh の起動が丸ごと失敗します（警告ではなく fatal）。なのでパッケージ導入成功後にだけ設定行を書く設計にしました
2. 周辺パッケージの npm latest タグが本体より古いことがあり（hooks ブリッジが rc.5、本体は rc.6）、ホストの dsh バージョンに固定してインストールします
3. dsh-hook-protocol は hooks ブリッジの peer 依存で、ホスト側に同梱されていないため一緒に入れる必要があります

デフォルトはドライランで、--apply を付けない限り何も書きません。再実行は安全で、生成ブロックはその場で置換、自分で書いた設定行は保持されます。

リポジトリ https://github.com/sjh9714/dsh-movein
npm dsh-movein
