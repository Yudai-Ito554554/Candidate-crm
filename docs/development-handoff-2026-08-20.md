# Candidate CRM 作業引き継ぎ（2026-08-19 職場PCセッション）

作成日: 2026-08-20（作業自体は2026-08-19 JST。日付を跨いだため作成日のみ翌日）
基準: `main` `9368593`（push済み、CI Run `32260244532` は全3ジョブ成功）
作業機: 職場Windows PC（`C:\dev\candidate-crm`）

production適用の実行計画は `docs/production-release-plan-2026-08-19-batch6a.md`、自宅PCへの移行手順は `docs/development-handoff-2026-08-19-home-pc-resume.md` が正本。本書はそれらを置き換えず、**2026-08-19に職場PCで完了した分と、次に手をつける場所**だけを記録する。

## 1. このセッションで完了したこと

| コミット  | 内容                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `bbc3b8e` | 自宅PCへの移行引き継ぎを追加（職場PCではWSL2がポリシーでブロック）      |
| `b8c5f8f` | 既存引き継ぎのWSL2節から上記へポインタ                                  |
| `3debb76` | **fix**: Supabase CLIをWindowsでシェル経由起動（readiness checkのバグ） |
| `3d71fc7` | S3-3の方式不成立をFable 5へ照会する文書                                 |
| `3704bb1` | **test**: pgTAP 007（viewerの書き込み拒否）                             |
| `2d9b046` | Fable 5決定（案D）の反映                                                |
| `9368593` | 決定文書3節(2)の訂正                                                    |

### 1.1 `scripts/check-supabase-readiness.mjs` のWindowsバグ修正（`3debb76`）

**修正済み。** Windowsでは `node_modules/.bin/supabase.cmd` が解決されるが、NodeはCVE-2024-27980の対策以降 `.cmd` の直接spawnを **EINVAL** で拒否するため、認証済みでも `npm run supabase:check:linked` が必ず「認証状態を確認できません」を返していた（false negative）。

共通ヘルパ `spawnSupabaseCli()` を追加し、win32のみシェル経由で起動する。**引数配列ではなく引用済みの単一コマンド文字列**を渡している。`shell: true` と引数配列の組み合わせはNode 24が `DEP0190`（引数が連結されるだけでエスケープされない）を警告するためで、この形なら警告が出ず、空白を含むリポジトリパスでも壊れない。非Windowsは従来どおり直接spawn。

実測での確認: 修正前は `unavailable` 分岐（「認証状態を確認できません」）、修正後は `missing_token` 分岐（「未認証です」）。このPCは当時未ログインだったので後者が正しい診断。**2026-08-20に `supabase login` 済みの状態で再実行し、`✓ Supabase CLIの認証を確認しました。` を含む全6項目の `✓` を確認した**（`Supabase linked非本番検証を開始できます。`）。これで修正の両分岐（認証済み／未認証）が実測で確認された。

`commandIsAvailable()` は変更していない。`docker` の起動にしか使われず、`.exe` なので直接spawnで動く。

### 1.2 S3-3の方式再決定（`3d71fc7` → `2d9b046` → `9368593`）

前回方式（web buildをブラウザで開きURLバーから直打ち）が成立しない理由をコード根拠つきで照会し、Fable 5が**案D（UAT要件の再定義）**を決定。前回方式は撤回された。

- 崩れた前提: 「Tauriでもブラウザでも同一のReact SPA」はUIとルーティングでは成立するが、**セッション永続化層では成立しない**（`persistSession: false` + 復元経路がOS資格情報ストアのみ）。ブラウザでは全ロールが未ログインで着地する
- Fable 5の自己申告として、この前提を崩したのは翌日承認したBatch 5であり、S3-3への波及を検討しなかったのは自分の欠落だと記録されている
- 却下: A（ログイン後の要求ルート復帰）はチェックリストのために本番コードを変える構図、C（web buildのみ `persistSession: true`）はBatch 5設計に反する
- **申し送りとして、認証・セッション層の変更は未完了項目の検証方式を無効化しうる**旨をチェックリストの「使い方」節へ追加した

決定文書は `docs/fable5-decision-s3-3-2026-08-19.md`、照会文書は `docs/fable5-request-s3-3-viewer-direct-url-2026-08-19.md`。

### 1.3 pgTAP 007 の追加（`3704bb1`）

決定文書は合格条件(2)「viewerが業務テーブルへINSERT/UPDATEできないことがpgTAPで固定されている」を**達成済みと記載していたが、実際には未達だった**。既存pgTAPは51個のpolicy式が `current_profile_role()` を参照することを構造として確認していたのみで、実書き込みを試みるfixtureは admin / suspended / pending の3ロールに限られ、**viewerで書き込みを試みる検証は存在しなかった**。

`supabase/tests/007_viewer_write_denial.test.sql` を追加（7 assertion）。

- viewerが candidates / companies を**読める**ことを先に固定（拒否が「viewerだから」であり「fixtureが見えていないから」ではないことを保証）
- candidates / companies / jobs へのINSERTが `42501` で失敗する
- UPDATEは**エラーコードではなく値**で確認する。`editors can update candidates` のUSING句にviewerは一致しないため、UPDATEは例外ではなく**0行更新**で終わるため

この指摘を受けてFable 5は決定文書3節(2)を訂正した（`9368593`。元の記述は日付つきの訂正として残してある）。

**CI Run `32260244532` で初回実行し PASS。** ローカルでは実行できない（`supabase test db` にDockerが必要）ため、検証はCIのUbuntuジョブが担保している。

## 2. S3-3 の現在地

| 合格条件                                                          | 状態                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| (1) 自動テストが編集7ルートで閲覧専用パネルを assert していること | ✅ 達成済み（`src/pages/app-routes.test.tsx:2811-2844`） |
| (2) viewerの書き込み拒否がpgTAPで固定されていること               | ✅ 2026-08-19に達成（007、CI検証済み）                   |
| (3) staging Tauriアプリでの実機UAT                                | ✅ **2026-08-20に完了**（下記3節）                       |

## 3. (3) の確認項目と実施結果（2026-08-20 完了）

staging Tauriアプリに**viewerでログイン**し、アプリ内で到達可能なあらゆる経路から編集画面へ到達を試みる。

**実施結果（2026-08-20、`0ec8419` ビルド、viewer `uat-viewer@example-uat.invalid`）: 合格。**

- ホーム画面に「新規登録」ボタンが出ない。`app-layout.tsx:249` の `EditorOnly` が `GlobalCreateMenu` ごと包んでいるため、`/candidates/import` を含む作成導線がまとめて消える
- `app-layout.tsx:281` の「閲覧専用モード：データの追加・変更・アーカイブはできません。」バナー（`role="status"`）が表示される
- 候補者詳細に編集導線（鉛筆アイコン）が出ない
- 対比として admin `uat-admin@example-uat.invalid` では同一画面に編集導線が出る。導線の不在がロールに由来することの担保

**観測したのは「導線の不在」側**で、`editor-route.tsx` の `role="alert"` パネルではない。導線が無い以上、編集ルートへ到達する経路自体が存在しないためで、決定書3節(3)は「閲覧専用パネルの表示、**または**導線の不在」を合格としている。ログイン画面への遷移は観測していない。任意項目（開発者ツールからの `history.pushState`）は未実施。

- グローバル作成メニュー（新規候補者・企業・求人）に導線が出ないこと
- 候補者・企業・求人の各詳細画面に編集ボタンが出ないこと
- 候補者取り込み画面（`/candidates/import`）への導線が出ないこと
- 一覧・詳細・タブ切替を一通り操作し、編集フォームへ到達できないこと

**観測点を取り違えないこと。** 合格の観測は「**閲覧専用パネル（`role="alert"` の「閲覧専用アカウントです」）が出ること、または導線自体が存在しないこと**」である。**ログイン画面へ飛ぶことは合格の証跡にならない**。`src/features/access/editor-route.tsx:18-35` はリダイレクトせずパネルを表示する実装なので、ログイン画面が出た場合はUATの手順が間違っている（未ログイン状態を見ている）。

任意項目: staging QAビルドで開発者ツールが開ける場合、コンソールから `history.pushState` でルートを直接切り替えてパネルが出ることを確認する。開けなければ不要。

## 4. S3-7（2026-08-20 完了）

S3-7（企業・求人の重複警告 / アーカイブ / 復元の実地確認）は、S3-3(3)と**同じstagingアプリで続けて実施できる**。ただし**書き込み操作なので admin か agent でログインし直す**こと（viewerのままでは操作導線が出ない）。候補者については2026-08-11に確認済みで、残っているのは企業・求人。

**実施結果: 完了。** 2026-08-20に admin `uat-admin@example-uat.invalid` で企業・求人のアーカイブ／復元を確認した。候補者は2026-08-11に確認済みで、3エンティティすべての実地確認が揃った。

## 5. production適用（2026-08-20にこのPCで実行可能になった）

**`wsl --install` が成功した（403は出なかった）。** 2026-08-19の「職場PCではWSL2のインストールが管理ポリシーによりブロックされる」という結論は**解消**した。`docs/development-handoff-2026-08-19-home-pc-resume.md` の「職場PCでは実行不可能」という記述は本節で上書きされる。

**現在は再起動待ち。** 再起動が済むまでWSL2は動かないので、この時点ではまだ何も実行できない。

### 再起動後の判定手順

1. `wsl --status` が版数を返すこと（2026-08-20午前は「インストールされていません」で exit 50 だった）
2. **Docker Desktopを起動する。** このPCでは一度もセットアップされていないため（設定キー `HKCU:\SOFTWARE\Docker Inc.\Docker\2.0` が存在しない）、初回起動でライセンス同意や管理者権限の要求が出る可能性がある。CLI（`docker.exe`）自体は導入済み
3. `docker info` が成功すること。これが `docs/production-release-plan-2026-08-19-batch6a.md` の前提条件1そのもの

3つとも通ればproduction適用へ進める。通らなければ自宅PCへ戻す（手順は上記の移行引き継ぎが正本）。

### 進める場合の注意

- 現在の link 先と `.env` は **staging `admjgbfrfoczpxdtxmgy`**。production は `dsaqarejqslzgcatkxeh` で、切り替えは実行計画の手順1（Runbook 1節の誤接続防止チェック、1名実施のため1.1の二段階確認）に従う
- production用 `AI_FINGERPRINT_HMAC_KEY_V1` は**未生成**。stagingとは別の値を使う（実行計画 前提条件3、手順4）
- Freeプランで自動バックアップが無く、手順2・3のバックアップが唯一の復旧手段。`.backup-db-ok` / `.backup-storage-ok` の2マーカーを確認してから先へ進む
- 手順6の `db push --dry-run` で**7本だけ**が出ることを確認する。1本でも差異があれば中止

## 5.1 再起動後に貼る文面

再起動が済んだら、次の文面をそのまま貼れば続きから再開できる。

```
再起動しました。WSL2の導入後です。

1. wsl --status と docker info を確認してください
2. 両方通ったら docs/development-handoff-2026-08-20.md 5節と
   docs/production-release-plan-2026-08-19-batch6a.md を読んで、
   production適用の手順1（誤接続防止チェック）から進めてください
3. db push --dry-run の結果は必ず見せて止まってください。
   7本以外が出たら中止です
4. 通らなかった場合は、何が足りないかを報告して止まってください
```

Docker Desktopの初回起動（ライセンス同意・管理者権限の要求が出る可能性がある）は手作業になるので、`docker info` が通らない場合はまずそこを疑う。

## 6. 次回このPCで再開する場合の最初のコマンド

```powershell
cd C:\dev\candidate-crm
git status
git pull --ff-only
git log --oneline -5
gh run list --branch main --limit 3
```

`9368593` 以降が入っていること、直近のCIが成功していることを確認してから着手する。

このPCで**できる**作業: 実機UAT（S3-3(3)・S3-7・S3-6は2026-08-20に完了し、**Stage 3Aの実機UATは全て終わった**）、コード修正全般、ドキュメント作業、CI経由でのpgTAP検証。
このPCで**できない**作業: production/staging へのmigration適用、バックアップ、`supabase db reset` / `supabase test db` のローカル実行（いずれもDocker必須）。

**`.env` は2026-08-20に設定済み**（`VITE_APP_ENV=staging`、link先 `admjgbfrfoczpxdtxmgy` = staging。production `dsaqarejqslzgcatkxeh` ではないことを確認済み）。`npm run supabase:check:linked` が全項目 `✓` を返す状態。

## 7. 積み残し

- ~~**deep link復帰のUX改善**~~: 2026-08-20に **B-6** として起票し実装済み（`src/features/auth/login-redirect.ts`、`protected-route.tsx`、`login-page.tsx`）。S3-3の合格条件ではない独立項目である点は変わらない
- **社員2名への配布**: Supabaseダッシュボードで直接ユーザー作成（Freeプランは招待メールが届かない）→ production版Windowsビルド配布 → role設定
- ~~`HANDOFF.md` の「最終更新 / 基準」が古い~~: 2026-08-20に `099d896` 基準へ更新し、S3-3・S3-7の行と5章・8章も実施結果へ揃えた

## 8. 秘密情報の扱い

本セッションでパスワード・APIキー・接続文字列の値を扱っていない。production用 `AI_FINGERPRINT_HMAC_KEY_V1` は**未生成のまま**であり、生成は自宅PCでの適用手順4（バックアップの後、migrationの前）で行う。
