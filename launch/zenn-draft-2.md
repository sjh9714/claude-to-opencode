# Zenn 2탄

タイトル：Claude Code 資産の DSH 互換性を rc.6 ソースで実測した対照表（リクエスト毎の token 請求書つき）

本文：

前回は引っ越しツール dsh-movein を紹介しました。今回はツールの裏にある調査そのものを公開します。Claude Code の各資産が DeepSeek Harness で実際どうなるか、全部 0.1.0-rc.6 のソースで逐項確認した結果と、意外と誰も計算していない「持ち込んだスキルがリクエスト毎に何 token 食うか」の実測です。

## 互換性対照表

| Claude Code 資産 | DSH 互換性 | 実際の挙動 |
| --- | --- | --- |
| プロジェクト CLAUDE.md | ネイティブ、作業ゼロ | instructionFileCandidates のデフォルトに CLAUDE.md が入っている |
| グローバル ~/.claude/CLAUDE.md | シンボリックリンク 1 本 | グローバル枠は $DSH_HOME/AGENTS.md のみ、リンクすれば終わり |
| スキル SKILL.md | フォーマットそのまま互換 | 未知の frontmatter キーは無視。ただし .claude/skills はデフォルトのスキルルートではないので ~/.dsh/skills へ |
| .mcp.json | 無損失の機械変換 | サーバー毎に dsh-mcp-client 行へ。ツール名 mcp__server__tool は両者で完全一致 |
| hooks | 公式ブリッジ、イベントは一部 | 既存設定をそのまま実行、30 イベント中 7 つをマップ、command 型のみ |
| 権限ルール | 非ネイティブ、ブリッジ可 | deny/ask は tools/pre-execute で強制可能。allow は対応物なし |
| サブエージェント | 直接インポート不可 | DSH のプリセットは agent.cordis.yml ディレクトリ。現実解はスキルへの変換 |
| セッション | 最難関、触らない | v0 フォーマットは互換性の約束なし。履歴は dsh-chat-import で |

## 実際に踏んだ罠 3 つ

1. profile が解決できないパッケージを patch に書くと dsh の起動が丸ごと失敗（fatal、警告ではない）
2. 周辺パッケージの npm latest タグが本体より古い（ホストの dsh バージョンに固定してインストール）
3. dsh-hook-protocol は hooks ブリッジの peer 依存でホストに同梱されない、一緒に入れる必要あり

## リクエスト毎の token 請求書

スキルカタログは system-reminder として毎リクエストに注入されます。ソースから逐字再構成してトークン化（o200k 近似）した結果：

| カタログ内のスキル数 | リクエスト毎 token |
| --- | --- |
| 0 | 143 |
| 20 | 703 |
| 40 | 1263 |
| 129 | 3755 |

固定の枠が 143 token、スキル 1 つにつき約 28 token（説明 96 文字換算）。129 個構成だと毎リクエスト 3.8k token。キャッシュはお金を節約しますが、コンテキストウィンドウは節約しません。

結論、引っ越す前に厳選する。使うスキルを運ぶ、持っているスキルを全部ではなく。説明文の長さがそのまま毎リクエストの請求額です。

## ツール

上記は全部 dsh-movein が自動化します（v0.4 から --reverse で DSH 生まれのスキルを Claude Code へ逆輸出、デュアルブート運用可）：

```sh
npx dsh-movein            # ドライラン
npx dsh-movein --apply    # DSH へ引っ越し
npx dsh-movein --reverse  # 逆方向
```

リポジトリ https://github.com/sjh9714/dsh-movein （対照表と token スクリプトは docs/ に、再現可能）
