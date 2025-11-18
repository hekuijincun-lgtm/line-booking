param(
  [ValidateSet("staging", "production")]
  [string]$Env = "staging"
)

# --- 0) パス & API_BASE ------------------------------------------------------

$RepoDir = Join-Path $HOME "repo/line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"

$ApiBaseMap = @{
  "staging"    = "https://saas-api-staging.hekuijincun.workers.dev"
  "production" = "https://saas-api.hekuijincun.workers.dev"
}

$API_BASE = $ApiBaseMap[$Env]

Write-Host "RepoDir : $RepoDir"
Write-Host "UiDir   : $UiDir"
Write-Host "Env     : $Env"
Write-Host "API_BASE: $API_BASE"
Write-Host ""

if (-not (Test-Path $UiDir)) {
  throw "UIディレクトリが見つかりません: $UiDir"
}

Set-Location $UiDir
Write-Host "📂 Now at UI dir: $UiDir"
Write-Host ""

# --- 1) 美容室テンプレ DSL を組み立て --------------------------------------

$DslJson = @"
{
  "version": 1,
  "page": {
    "id": "kazuki-booking-hair",
    "title": "Kazuki Booking - Hair",
    "subtitle": "本日の美容室予約枠",
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
        "title": "ご予約情報",
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
              "label": "メニュー・ご要望（任意）",
              "inputType": "textarea",
              "placeholder": "カット / カラー / トリートメント など",
              "required": false,
              "rows": 2
            }
          ]
        }
      },
      {
        "id": "slots",
        "type": "slotList",
        "title": "本日の空き枠",
        "props": {
          "reloadButtonLabel": "再読み込み",
          "emptyText": "本日の空き枠はありません。",
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
          "text": "Kazuki Booking Hair テンプレートから生成されたUIです。"
        }
      }
    ]
  }
}
"@

# --- 2) booking-ui-hair.json として保存 -------------------------------------

$DslPath = Join-Path $UiDir "booking-ui-hair.json"
$DslJson | Set-Content -Encoding UTF8 -Path $DslPath

Write-Host "✅ 美容室テンプレDSLを生成しました: $DslPath"
Write-Host ""
