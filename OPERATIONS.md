# OPERATIONS

## Health
- Staging:  https://saas-api-staging.hekuijincun.workers.dev/__health?token=MY-HEALTH-TOKEN-ONLY
- Production: https://saas-api.hekuijincun.workers.dev/__health?token=MY-HEALTH-TOKEN-ONLY
- OK: 200 / NG: 503
- hasKV=false の場合はNG扱い

## Monitoring (最小)
- wrangler tail --env=staging / --env=production
- 例外は Slack に [A-PHASE][ERROR] で通知（最小）

## Smoke 手順（手動）
- /set-slots {YYYY-MM-DD} 10:00-12:00 → /reserve → /my → /cancel
- staging / production で実行＆ログ保存（OneDrive\Backups\SalonLeads\smoke-results.csv）

## Failure テスト
- 二重予約 → 片方NGでOK（DOロック）
- 過去予約 → 拒否メッセージ
- 不正署名 → 403

## ロールバック（例）
- git revert または 前タグへ wrangler deploy --env=...（固定リビジョン）
- 直前の .bak が repo にあれば復元

## Secrets 監査（例）
- LINE_CHANNEL_SECRET__staging / __production（SecretStore）
- SLACK_WEBHOOK_URL__production（SecretStore or wrangler secrets）
- wrangler.toml の env.*.vars は **重複しない**こと（2025-11-09 整理済み）

