(function () {
  // --- 共通ユーティリティ -------------------------------------------------

  function getQueryParams() {
    var params = {};
    var q = window.location.search || "";
    if (q.startsWith("?")) q = q.substring(1);
    q.split("&").forEach(function (pair) {
      if (!pair) return;
      var parts = pair.split("=");
      var key = decodeURIComponent(parts[0] || "");
      var val = decodeURIComponent(parts[1] || "");
      if (!key) return;
      params[key] = val;
    });
    return params;
  }

  function createEl(tag, props, children) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === "className") {
        el.className = props[k];
      } else if (k === "onClick") {
        el.addEventListener("click", props[k]);
      } else if (k === "type") {
        el.type = props[k];
      } else if (k === "value") {
        el.value = props[k];
      } else if (k === "placeholder") {
        el.placeholder = props[k];
      } else if (k === "rows") {
        el.rows = props[k];
      } else {
        el.setAttribute(k, props[k]);
      }
    });

    if (children === undefined || children === null) {
      // no-op
    } else if (Array.isArray(children)) {
      children.forEach(function (c) {
        if (typeof c === "string") {
          el.appendChild(document.createTextNode(c));
        } else if (c instanceof Node) {
          el.appendChild(c);
        }
      });
    } else if (typeof children === "string") {
      el.appendChild(document.createTextNode(children));
    } else if (children instanceof Node) {
      el.appendChild(children);
    }
    return el;
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // --- DSL ロード ----------------------------------------------------------

  var params = getQueryParams();
  var template = params.template || "default";

  var dslFile;
  if (template === "default") {
    dslFile = "booking-ui.json";
  } else {
    // booking-ui-<template>.json を探す想定
    dslFile = "booking-ui-" + template + ".json";
  }

  console.log("[KazukiBooking] template =", template, "dslFile =", dslFile);

  var app = document.getElementById("app");
  if (!app) {
    console.error("#app 要素が見つかりません。");
    return;
  }

  fetch(dslFile, { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("DSL fetch failed: " + res.status);
      return res.json();
    })
    .then(function (dsl) {
      buildFromDsl(dsl);
    })
    .catch(function (err) {
      console.error("DSL 読み込みエラー:", err);
      clearChildren(app);
      app.appendChild(
        createEl("div", { className: "kb-error-root" },
          "設定ファイルの読み込みに失敗しました。管理者へご連絡ください。"
        )
      );
    });

  // --- DSL から UI を構築する本体 -----------------------------------------

  function buildFromDsl(dsl) {
    clearChildren(app);

    var page = dsl.page || {};
    var api  = dsl.api  || {};
    var layout = (dsl.layout && Array.isArray(dsl.layout.sections))
      ? dsl.layout.sections
      : [];

    var baseUrl    = api.baseUrl    || (window.API_BASE || "");
    var slotsPath  = api.slotsPath  || "/line/slots";
    var reservePath = api.reservePath || "/line/reserve";

    var headerSec = layout.find(function (s) { return s.id === "header"; });
    var formSec   = layout.find(function (s) { return s.id === "booking-form"; });
    var slotsSec  = layout.find(function (s) { return s.id === "slots"; });
    var statusSec = layout.find(function (s) { return s.id === "status"; });
    var footerSec = layout.find(function (s) { return s.id === "footer"; });

    // 予約情報（入力値）管理
    var formState = {
      name: "",
      note: ""
    };

    // DOM ルート
    var root = createEl("div", { className: "kb-root" }, []);
    app.appendChild(root);

    // --- ヘッダー ----------------------------------------------------------

    var header = createEl("header", { className: "kb-header" }, [
      createEl("div", { className: "kb-brand" }, [
        createEl("div", { className: "kb-brand-tag" }, "|"),
        createEl("div", { className: "kb-brand-text" }, [
          createEl("h1", { className: "kb-title" }, page.title || "Kazuki Booking"),
          createEl("p", { className: "kb-subtitle" }, page.subtitle || "本日の空き枠")
        ])
      ]),
      createEl("div", { className: "kb-env-chip" }, (api.envLabel || "ENV: staging"))
    ]);

    // --- コンテナ ----------------------------------------------------------

    var container = createEl("main", { className: "kb-container" }, []);
    root.appendChild(header);
    root.appendChild(container);

    // --- フォームセクション ------------------------------------------------

    var formCard = createEl("section", { className: "kb-card" }, []);
    container.appendChild(formCard);

    var formTitle = (formSec && formSec.title) || "予約情報";
    formCard.appendChild(
      createEl("h2", { className: "kb-card-title" }, formTitle)
    );

    // お名前
    var nameField = createEl("div", { className: "kb-field" }, [
      createEl("label", { className: "kb-field-label" }, "お名前（任意）"),
      createEl("input", {
        className: "kb-input",
        type: "text",
        placeholder: "山田 太郎 など"
      })
    ]);
    var nameInput = nameField.querySelector("input");
    nameInput.addEventListener("input", function (e) {
      formState.name = e.target.value || "";
    });

    // メモ
    var noteField = createEl("div", { className: "kb-field" }, [
      createEl("label", { className: "kb-field-label" }, "メモ（任意）"),
      createEl("textarea", {
        className: "kb-textarea",
        rows: 2,
        placeholder: "メニューや希望など"
      })
    ]);
    var noteInput = noteField.querySelector("textarea");
    noteInput.addEventListener("input", function (e) {
      formState.note = e.target.value || "";
    });

    formCard.appendChild(nameField);
    formCard.appendChild(noteField);

    // --- スロットセクション ------------------------------------------------

    var slotsCard = createEl("section", { className: "kb-card kb-card-slots" }, []);
    container.appendChild(slotsCard);

    var slotsTitle = (slotsSec && slotsSec.title) || "空き枠";
    slotsCard.appendChild(
      createEl("div", { className: "kb-card-header-row" }, [
        createEl("h2", { className: "kb-card-title" }, slotsTitle),
        createEl("button", {
          className: "kb-btn kb-btn-ghost",
          onClick: function () {
            loadSlots();
          }
        }, "再読み込み")
      ])
    );

    var slotsBody = createEl("div", { className: "kb-slot-body" }, []);
    var slotsList = createEl("div", { className: "kb-slot-list" }, []);
    var slotsEmptyMsg = createEl("p", { className: "kb-slot-empty" }, "空き枠がありません。");

    slotsBody.appendChild(slotsList);
    slotsBody.appendChild(slotsEmptyMsg);
    slotsCard.appendChild(slotsBody);

    // --- ステータス --------------------------------------------------------

    var statusRoot = createEl("div", { className: "kb-status" }, "");
    container.appendChild(statusRoot);

    function showStatusOk(msg) {
      statusRoot.className = "kb-status kb-status-ok";
      clearChildren(statusRoot);
      if (msg) statusRoot.appendChild(document.createTextNode(msg));
    }

    function showStatusError(msg) {
      statusRoot.className = "kb-status kb-status-error";
      clearChildren(statusRoot);
      if (msg) statusRoot.appendChild(document.createTextNode(msg));
    }

    function clearStatus() {
      statusRoot.className = "kb-status";
      clearChildren(statusRoot);
    }

    // --- フッター ----------------------------------------------------------

    var footerText = (footerSec && footerSec.props && footerSec.props.text)
      || "LINEからの予約と連動したサンプルUIです。";

    var footer = createEl("footer", { className: "kb-footer" }, [
      createEl("p", { className: "kb-footer-text" }, footerText)
    ]);
    container.appendChild(footer);

    // --- スロット読み込み & 予約 -------------------------------------------

    function renderSlots(items) {
      clearChildren(slotsList);

      if (!items || !items.length) {
        slotsEmptyMsg.style.display = "block";
        return;
      }

      slotsEmptyMsg.style.display = "none";

      items.forEach(function (slot) {
        var isFull = !!slot.isFull || slot.status === "full" || slot.status === "closed";
        var label = slot.label || (slot.startTime && slot.endTime
          ? (slot.startTime + " - " + slot.endTime)
          : "枠");

        var remaining = slot.remaining;
        var metaText = "";
        if (typeof remaining === "number") {
          if (remaining <= 0) metaText = "満席";
          else metaText = "残り" + remaining + "枠";
        }

        var slotBtn = createEl("button", {
          className: "kb-slot" + (isFull ? " kb-slot-full" : ""),
          disabled: isFull,
          onClick: function () {
            if (isFull) return;
            reserve(slot);
          }
        }, [
          createEl("div", { className: "kb-slot-time" }, label),
          createEl("div", { className: "kb-slot-meta" }, metaText)
        ]);

        slotsList.appendChild(slotBtn);
      });
    }

    function loadSlots() {
      clearStatus();
      slotsEmptyMsg.textContent = "読み込み中...";
      slotsEmptyMsg.style.display = "block";
      clearChildren(slotsList);

      var url = baseUrl + slotsPath;

      fetch(url, { method: "GET" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var slots = data && Array.isArray(data.slots) ? data.slots : [];
          if (!slots.length) {
            slotsEmptyMsg.textContent = "空き枠がありません。";
          }
          renderSlots(slots);
        })
        .catch(function (err) {
          console.error("loadSlots error:", err);
          slotsEmptyMsg.textContent = "空き枠の取得に失敗しました。しばらくしてから再度お試しください。";
          showStatusError("エラー：空き枠の取得に失敗しました。しばらくしてから再度お試しください。");
        });
    }

    function reserve(slot) {
      clearStatus();
      showStatusOk("予約処理中です...");

      var url = baseUrl + reservePath;

      var payload = {
        slotId: slot.id,
        name: formState.name || null,
        note: formState.note || null
      };

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          console.log("reserve result:", data);
          showStatusOk("予約が完了しました。LINEのメッセージもご確認ください。");
          loadSlots();
        })
        .catch(function (err) {
          console.error("reserve error:", err);
          showStatusError("エラー：予約に失敗しました。しばらくしてから再度お試しください。");
        });
    }

    // 初回読み込み
    loadSlots();
  }
})();
