param(
  [ValidateSet("staging", "production")]
  [string]$Env = "staging"
)

# --- 0) 共通パス設定 --------------------------------------------------------

$RepoDir = Join-Path $HOME "repo/line-booking"
$UiDir   = Join-Path $RepoDir "booking-ui-static"
$MainJs  = Join-Path $UiDir "main.js"

Write-Host "RepoDir : $RepoDir"
Write-Host "UiDir   : $UiDir"
Write-Host "MainJs  : $MainJs"
Write-Host "Env     : $Env"
Write-Host ""

if (-not (Test-Path $UiDir)) {
  throw "UIディレクトリが見つかりません: $UiDir"
}

Set-Location $UiDir
Write-Host "📂 Now at UI dir: $UiDir"
Write-Host ""

# --- 1) main.js 本体（DSL駆動UI） -------------------------------------------

$js = @"
// Kazuki Booking - DSL driven UI
// booking-ui.json を読み込んで UI を構築する

(async function() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('app コンテナが見つかりません');
    return;
  }

  let dsl = null;
  let state = {
    slots: [],
    loading: false,
    error: '',
    success: ''
  };

  // DOM ヘルパー
  function h(tag, options = {}, ...children) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.text) el.textContent = options.text;
    if (options.html) el.innerHTML = options.html;
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([k, v]) => {
        if (v !== undefined && v !== null) el.setAttribute(k, v);
      });
    }
    if (options.onClick) {
      el.addEventListener('click', options.onClick);
    }
    children.forEach(child => {
      if (child == null) return;
      if (Array.isArray(child)) {
        child.forEach(c => c && el.appendChild(c));
      } else if (child instanceof Node) {
        el.appendChild(child);
      } else if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      }
    });
    return el;
  }

  function clearApp() {
    while (app.firstChild) app.removeChild(app.firstChild);
  }

  // DSL 読み込み
  async function loadDsl() {
    const res = await fetch('./booking-ui.json', { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error('booking-ui.json の取得に失敗しました: ' + res.status);
    }
    dsl = await res.json();
    document.title = dsl.page?.title || 'Kazuki Booking';
  }

  function getApiConfig() {
    const base = dsl.api?.baseUrl || '';
    const slotsPath = dsl.api?.slotsPath || '/line/slots';
    const reservePath = dsl.api?.reservePath || '/line/reserve';
    return {
      slotsUrl: base + slotsPath,
      reserveUrl: base + reservePath
    };
  }

  // スロット取得
  async function fetchSlots() {
    const { slotsUrl } = getApiConfig();
    state.loading = true;
    state.error = '';
    render();

    try {
      const res = await fetch(slotsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const json = await res.json();
      // API 仕様に合わせてここで shape を調整する
      // 例: { slots: [...] } 形式なら json.slots を使う
      const slots = json.slots || json || [];
      state.slots = Array.isArray(slots) ? slots : [];
      state.loading = false;
      render();
    } catch (err) {
      console.error(err);
      state.loading = false;
      state.error = '空き枠の取得に失敗しました。しばらくしてから再度お試しください。';
      render();
    }
  }

  // 予約 POST
  async function reserveSlot(slot) {
    const { reserveUrl } = getApiConfig();
    state.error = '';
    state.success = '';

    const nameInput = document.querySelector('[data-field-id="name"]');
    const noteInput = document.querySelector('[data-field-id="note"]');
    const name = nameInput ? nameInput.value : '';
    const note = noteInput ? noteInput.value : '';

    try {
      const body = {
        slotId: slot.id || slot.slotId || slot.slot_id,
        name,
        note
      };

      const res = await fetch(reserveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('reserve error', res.status, text);
        throw new Error('予約に失敗しました');
      }

      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      state.success = '予約が完了しました。LINEのメッセージをご確認ください。';
      state.error = '';
      // 予約後にスロット一覧を更新
      await fetchSlots();
    } catch (err) {
      console.error(err);
      state.error = '予約に失敗しました。通信環境をご確認のうえ、再度お試しください。';
      state.success = '';
      render();
    }
  }

  // セクション描画
  function renderFormSection(section) {
    const fields = section.props?.fields || [];
    const fieldNodes = fields.map(field => {
      const id = field.id;
      const label = field.label || id;
      const inputType = field.inputType || 'text';

      const labelEl = h('label', { className: 'kb-label' }, label);
      let inputEl;
      if (inputType === 'textarea') {
        inputEl = h('textarea', {
          className: 'kb-input',
          attrs: {
            'data-field-id': id,
            rows: field.rows || 2,
            placeholder: field.placeholder || ''
          }
        });
      } else {
        inputEl = h('input', {
          className: 'kb-input',
          attrs: {
            type: inputType,
            'data-field-id': id,
            placeholder: field.placeholder || ''
          }
        });
      }

      return h('div', { className: 'kb-field' }, labelEl, inputEl);
    });

    return h(
      'section',
      { className: 'kb-section kb-section-form' },
      section.title ? h('h2', { className: 'kb-section-title', text: section.title }) : null,
      ...fieldNodes
    );
  }

  function renderSlotsSection(section) {
    const props = section.props || {};
    const title = section.title || '空き枠';
    const reloadLabel = props.reloadButtonLabel || '再読み込み';
    const emptyText = props.emptyText || '空き枠がありません。';
    const loadingText = props.loadingText || '読み込み中...';

    let content;

    if (state.loading) {
      content = h('p', { className: 'kb-text-muted', text: loadingText });
    } else if (!state.slots || state.slots.length === 0) {
      content = h('p', { className: 'kb-text-muted', text: emptyText });
    } else {
      const items = state.slots.map(slot => {
        const labelKey = props.slotLabelKey || 'label';
        const label = slot[labelKey] || slot.label || '枠';

        const isFullKey = props.fullCondition?.isFullKey;
        const statusKey = props.fullCondition?.statusKey;
        const fullValues = props.fullCondition?.fullValues || ['full', 'closed'];

        let isFull = false;
        if (isFullKey && typeof slot[isFullKey] === 'boolean') {
          isFull = !!slot[isFullKey];
        } else if (statusKey && slot[statusKey]) {
          isFull = fullValues.includes(String(slot[statusKey]).toLowerCase());
        }

        const btnClass = isFull
          ? 'kb-slot kb-slot-full'
          : 'kb-slot kb-slot-available';

        const clickHandler = isFull
          ? null
          : () => reserveSlot(slot);

        return h(
          'button',
          {
            className: btnClass,
            onClick: clickHandler,
            attrs: { type: 'button' }
          },
          label
        );
      });

      content = h('div', { className: 'kb-slot-list' }, items);
    }

    const reloadBtn = h(
      'button',
      {
        className: 'kb-reload-btn',
        onClick: () => fetchSlots(),
        attrs: { type: 'button' }
      },
      reloadLabel
    );

    return h(
      'section',
      { className: 'kb-section kb-section-slots' },
      h('div', { className: 'kb-section-header' },
        h('h2', { className: 'kb-section-title', text: title }),
        reloadBtn
      ),
      content
    );
  }

  function renderStatusSection(section) {
    const successPrefix = section.props?.successPrefix || '';
    const errorPrefix = section.props?.errorPrefix || 'エラー：';

    const nodes = [];
    if (state.success) {
      nodes.push(
        h('div', { className: 'kb-status kb-status-success' },
          successPrefix + state.success
        )
      );
    }
    if (state.error) {
      nodes.push(
        h('div', { className: 'kb-status kb-status-error' },
          errorPrefix + state.error
        )
      );
    }
    if (nodes.length === 0) return null;

    return h('section', { className: 'kb-section kb-section-status' }, nodes);
  }

  function renderFooterSection(section) {
    const text = section.props?.text || '';
    if (!text) return null;
    return h(
      'footer',
      { className: 'kb-footer' },
      h('p', { className: 'kb-footer-text', text })
    );
  }

  function renderRoot() {
    clearApp();

    const pageTitle = dsl.page?.title || 'Kazuki Booking';
    const pageSubtitle = dsl.page?.subtitle || '';
    const header = h(
      'header',
      { className: 'kb-header' },
      h('h1', { className: 'kb-title', text: pageTitle }),
      pageSubtitle ? h('p', { className: 'kb-subtitle', text: pageSubtitle }) : null
    );

    const sections = dsl.layout?.sections || [];
    const sectionNodes = sections.map(section => {
      if (!section || !section.type) return null;
      switch (section.type) {
        case 'form':
          return renderFormSection(section);
        case 'slotList':
          return renderSlotsSection(section);
        case 'status':
          return renderStatusSection(section);
        case 'footer':
          return renderFooterSection(section);
        default:
          return null;
      }
    }).filter(Boolean);

    app.appendChild(
      h('div', { className: 'kb-container' }, header, ...sectionNodes)
    );
  }

  function render() {
    if (!dsl) return;
    renderRoot();
  }

  // init
  try {
    await loadDsl();
    render();
    await fetchSlots();
  } catch (err) {
    console.error(err);
    clearApp();
    app.appendChild(
      h('div', { className: 'kb-error-root' },
        '設定ファイルの読み込みに失敗しました。管理者へご連絡ください。'
      )
    );
  }
})();
"@

# --- 2) main.js に書き出し --------------------------------------------------

$js | Set-Content -Encoding UTF8 -Path $MainJs

Write-Host "✅ main.js を DSL駆動版として生成しました: $MainJs"
Write-Host ""
