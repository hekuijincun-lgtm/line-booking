param(
  [ValidateSet("staging", "production")]
  [string]$Env = "staging"
)

# --- 0) 共通パス & API_BASE 設定 -------------------------------------------

$RepoDir = Join-Path $HOME "repo/line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"

$ApiBaseMap = @{
  "staging"    = "https://saas-api-staging-v4.hekuijincun.workers.dev"
  "production" = "https://saas-api-v4.hekuijincun.workers.dev"
}

$API_BASE = $ApiBaseMap[$Env]

Write-Host "RepoDir : $RepoDir"
Write-Host "UiDir   : $UiDir"
Write-Host "Env     : $Env"
Write-Host "API_BASE: $API_BASE"
Write-Host ""

# --- 1) UI ディレクトリの存在確認 ------------------------------------------

if (-not (Test-Path $UiDir)) {
  Write-Host "📂 UIディレクトリが無いので作成: $UiDir"
  New-Item -ItemType Directory -Path $UiDir | Out-Null
}

Set-Location $UiDir
Write-Host "📂 Now at UI dir: $UiDir"
Write-Host ""

# --- 2) DSL(JSON) 本体を組み立て ------------------------------------------

$DslJson = @"
{
  "version": 1,
  "page": {
    "id": "kazuki-booking",
    "title": "Kazuki Booking",
    "subtitle": "本日の空き枠",
    "theme": "white-deepblue-gold"
  },
  "api": {
    "baseUrl": "$API_BASE",
    "slotsPath": "/line/slots",
    "reservePath": "/line/reserve"
  },
  "layout": {
    "sections": [
      {
        "id": "booking-form",
        "type": "form",
        "title": "予約情報",
        "props": {
          "fields": [
            {
              "id": "name",
              "label": "お名前（任意）",
              "inputType": "text",
              "placeholder": "山田 太郎",
              "required": false
            },
            {
              "id": "note",
              "label": "メモ（任意）",
              "inputType": "textarea",
              "placeholder": "メニューや希望など",
              "required": false,
              "rows": 2
            }
          ]
        }
      },
      {
        "id": "slots",
        "type": "slotList",
        "title": "空き枠",
        "props": {
          "reloadButtonLabel": "再読み込み",
          "emptyText": "空き枠がありません。",
          "loadingText": "読み込み中...",
          "slotLabelKey": "label",
          "slotDetail": {
            "startKey": "startTime",
            "endKey": "endTime",
            "remainingKey": "remaining"
          },
          "fullCondition": {
            "statusKey": "status",
            "fullValues": ["full", "closed"],
            "isFullKey": "isFull"
          }
        }
      },
      {
        "id": "status",
        "type": "status",
        "props": {
          "successPrefix": "",
          "errorPrefix": "エラー："
        }
      },
      {
        "id": "footer",
        "type": "footer",
        "props": {
          "text": "LINEからの予約と連動したサンプルUIです。"
        }
      }
    ]
  }
}
"@

# --- 3) booking-ui.json として保存 -----------------------------------------

$DslPath = Join-Path $UiDir "booking-ui.json"
$DslJson | Set-Content -Encoding UTF8 -Path $DslPath

Write-Host "✅ DSL を生成しました: $DslPath"
Write-Host ""

