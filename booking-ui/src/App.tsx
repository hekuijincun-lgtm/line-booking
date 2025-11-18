import React, { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ?? "https://saas-api-v4.hekuijincun.workers.dev";

type Slot = {
  slotId?: string;      // 🔸 追加: バックエンドの slotId / id を保持
  time: string;
  status: string;
  popular?: boolean;
  rawLabel?: string;    // 10:00〜11:00 みたいなラベル保持用
};

// API の time / start / label をいい感じに HH:mm に整形するヘルパー
function formatTime(raw: any): string {
  // 1) 文字列の場合
  if (typeof raw === "string") {
    // (1-a) "10:00" / "9:00" みたいな形式ならそのまま
    if (/^\d{1,2}:\d{2}$/.test(raw)) return raw;

    // (1-b) "10:00〜11:00" みたいな場合は先頭の HH:mm だけ抜く
    const m = raw.match(/^(\d{1,2}:\d{2})/);
    if (m && m[1]) return m[1];

    // (1-c) ISO 形式など Date.parse できるならパースして HH:mm に
    const iso = Date.parse(raw);
    if (!Number.isNaN(iso)) {
      const d = new Date(iso);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      return `${hh}:${mm}`;
    }
  }

  // 2) オブジェクトの場合は time / label / start / slot のいずれかを見る
  if (raw && typeof raw === "object") {
    const labelLike =
      (raw as any).time ??
      (raw as any).label ??
      (raw as any).start ??
      (raw as any).slot;
    if (typeof labelLike === "string") return formatTime(labelLike);
  }

  return "時間未設定";
}

// --------------------- App 本体 ---------------------
function App() {
  // 共通スクロールヘルパー
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleClickReserveNow = () => {
    scrollToSection("kb-booking-section");
  };

  const handleClickHowToUse = () => {
    scrollToSection("kb-howitworks-section");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-navy via-slate-950 to-brand-navy text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <Header />

        <main className="mt-6 space-y-6 sm:space-y-8">
          <Hero
            onClickReserveNow={handleClickReserveNow}
            onClickHowToUse={handleClickHowToUse}
          />

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <BookingSection />
            <BrandSideCard />
          </div>

          <HowItWorks />
        </main>

        <Footer />
      </div>
    </div>
  );
}

// --------------------- Header ---------------------
const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-soft backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-yellow-400 text-brand-navy font-extrabold text-lg shadow-soft">
          KG
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand-gold">
            Kazuki Group
          </p>
          <h1 className="text-sm font-semibold text-slate-50">
            Kazuki Booking
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] sm:text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </span>
        <span className="hidden text-slate-300/80 sm:inline">
          かずき専用 予約SaaS（v1 Brand）
        </span>
      </div>
    </header>
  );
};

// --------------------- Hero（上部メイン） ---------------------
type HeroProps = {
  onClickReserveNow: () => void;
  onClickHowToUse: () => void;
};

const Hero: React.FC<HeroProps> = ({
  onClickReserveNow,
  onClickHowToUse,
}) => {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft backdrop-blur-md sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3 sm:space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-medium text-brand-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            “ただの予約フォーム” を、ブランド体験に。
          </p>
          <div>
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
              Kazuki Booking で{" "}
              <span className="bg-gradient-to-r from-brand-gold to-amber-300 bg-clip-text text-transparent">
                予約も信頼も
              </span>{" "}
              自動で貯まる。
            </h2>
            <p className="mt-2 text-sm text-slate-200 sm:text-base">
              お客様はLINEからサクッと予約。
              裏側では Cloudflare × LINE × API が自動で仕事してくれる“ちゃんとした”予約SaaS。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 sm:pt-2">
            <button
              type="button"
              onClick={onClickReserveNow}
              className="inline-flex items-center justify-center rounded-2xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft transition hover:translate-y-0.5 hover:bg-yellow-300 active:translate-y-[1px]"
            >
              今すぐ予約する
            </button>
            <button
              type="button"
              onClick={onClickHowToUse}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-black/50"
            >
              使い方を見る
            </button>
          </div>
        </div>

        <div className="mt-4 w-full max-w-xs rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-slate-100 shadow-soft sm:mt-0">
          <p className="mb-2 text-[11px] font-semibold text-slate-300">
            今日の予約サマリー
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-center justify-between">
              <span className="text-slate-300">本日の予約</span>
              <span className="font-semibold text-brand-gold">7 件</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-300">稼働枠</span>
              <span className="font-semibold text-slate-50">12 / 16</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-300">リピート率</span>
              <span className="font-semibold text-emerald-300">68%</span>
            </li>
          </ul>
          <p className="mt-3 text-[10px] text-slate-400">
            ※ ここは後で /admin と統合して、リアルタイムのD1集計に差し替え予定。
          </p>
        </div>
      </div>
    </section>
  );
};

// --------------------- BookingSection ---------------------
const BookingSection: React.FC = () => {
  // デフォルトの見た目用フォールバック
  const fallbackSlots: Slot[] = [
    { time: "13:00", status: "空き", popular: true, rawLabel: "13:00〜14:00" },
    {
      time: "14:30",
      status: "残り1枠",
      popular: true,
      rawLabel: "14:30〜15:30",
    },
    { time: "16:00", status: "空き", popular: false, rawLabel: "16:00〜17:00" },
    {
      time: "18:30",
      status: "満席",
      popular: false,
      rawLabel: "18:30〜19:30",
    },
  ];

  const [slots, setSlots] = useState<Slot[]>(fallbackSlots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 選択中の枠
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // フォーム入力値
  const [name, setName] = useState("");
  const [menu, setMenu] = useState("");
  const [note, setNote] = useState("");

  // 送信状態
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSlots = async () => {
      setLoading(true);
      setError(null);

      try {
        const now = new Date();
        const ymd = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const url = `${API_BASE}/line/slots?date=${ymd}`;

        console.log("▶ /line/slots URL", url);

        const res = await fetch(url, {
          signal: controller.signal,
        });

        if (!res.ok) {
          // 400 の bad date などもここに入る
          throw new Error(`HTTP ${res.status}`);
        }

        const data: unknown = await res.json();
        console.log("⬇ /line/slots response", data);

        let nextSlots: Slot[] | null = null;

        // パターン1: API が配列で返す場合
        if (Array.isArray(data)) {
          nextSlots = data
            .map((raw: unknown) => {
              if (typeof raw === "string") {
                return {
                  time: formatTime(raw),
                  status: "空き",
                  rawLabel: raw,
                } as Slot;
              }
              if (raw && typeof raw === "object") {
                const obj = raw as any;
                const time = formatTime(obj);
                const status =
                  obj.status ??
                  (obj.isFull || obj.full || obj.remaining === 0
                    ? "満席"
                    : "空き");
                const popular = !!obj.popular;
                const rawLabel: string | undefined =
                  typeof obj.label === "string" ? obj.label : undefined;
                const slotId: string | undefined =
                  typeof obj.slotId === "string"
                    ? obj.slotId
                    : typeof obj.id === "string"
                    ? obj.id
                    : undefined;

                return { time, status, popular, rawLabel, slotId } as Slot;
              }
              return null;
            })
            .filter((x: Slot | null): x is Slot => x !== null);
        }

        // パターン2: { slots: [...] } 形式
        if (!nextSlots && data && Array.isArray((data as any).slots)) {
          nextSlots = (data as any).slots
            .map((raw: unknown) => {
              if (typeof raw === "string") {
                return {
                  time: formatTime(raw),
                  status: "空き",
                  rawLabel: raw,
                } as Slot;
              }
              if (raw && typeof raw === "object") {
                const obj = raw as any;
                const time = formatTime(obj);
                const status =
                  obj.status ??
                  (obj.isFull || obj.full || obj.remaining === 0
                    ? "満席"
                    : "空き");
                const popular = !!obj.popular;
                const rawLabel: string | undefined =
                  typeof obj.label === "string" ? obj.label : undefined;
                const slotId: string | undefined =
                  typeof obj.slotId === "string"
                    ? obj.slotId
                    : typeof obj.id === "string"
                    ? obj.id
                    : undefined;

                return { time, status, popular, rawLabel, slotId } as Slot;
              }
              return null;
            })
            .filter((x: Slot | null): x is Slot => x !== null);
        }

        if (nextSlots && nextSlots.length > 0) {
          setSlots(nextSlots);
        } else {
          console.warn(
            "slots API 応答は取得できたが、構造が想定外のためフォールバック継続"
          );
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("slots API error", err);
        setError(
          "リアルタイムの空き枠を取得できませんでした。時間をおいて再度お試しください。"
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchSlots();

    return () => controller.abort();
  }, []);

  // 枠クリック時
  const handleSelectSlot = (slot: Slot) => {
    if (slot.status === "満席") return;
    setSelectedSlot(slot);
  };

  // カレンダーから選ぶ（まだ未実装なのでアラートだけ）
  const handleCalendarClick = () => {
    alert(
      "「カレンダーから選ぶ」は次のフェーズで実装予定です🥹\n\n今は「今日」タブの空き枠で動作確認するモードになっています。"
    );
  };

  // フォーム送信（/line/reserve に投げつつ、slotId 無い場合はダミーモード）
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setSubmitMessage(null);

    if (!selectedSlot) {
      alert("先に予約枠を選択してください。");
      return;
    }
    if (!name.trim() || !menu.trim()) {
      alert("お名前とメニューを入力してください。");
      return;
    }

    const basePayload = {
      slotTime: selectedSlot.time,
      slotLabel: selectedSlot.rawLabel ?? `${selectedSlot.time}〜`,
      name,
      menu,
      note,
      source: "booking-ui-v1",
    };

    // slotId が無い場合は「テストモード」でコンソール出力のみ
    if (!selectedSlot.slotId) {
      console.warn("slotId missing, fallback to dummy mode", basePayload);
      alert(
        "この環境では slotId が取得できなかったため、テストモードで動作しました。\n（実際の予約は確定されていません／内容はコンソールに記録されています）"
      );
      setSubmitMessage(
        "現在この画面はテストモードで動作中です。実際の予約は LINE から確定してください。"
      );
      return;
    }

    const payload = {
      slotId: selectedSlot.slotId,
      name,
      menu,
      note,
      source: "booking-ui-v1",
    };

    console.log("📨 Reserve payload:", payload);

    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE}/line/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const bodyText = await res.text().catch(() => "");
      console.log("✅ /line/reserve response:", bodyText);

      setSubmitMessage(
        "予約リクエストを送信しました。LINE側の確認メッセージをご確認ください。"
      );

      // 軽くフォームをクリア（メモだけ）
      setNote("");
    } catch (err) {
      console.warn("⚠ /line/reserve error", err);

      setSubmitMessage(
        "予約APIとの通信でエラーが発生しました。時間をおいて再度お試しください。"
      );
      alert(
        "予約APIとの通信でエラーが発生しました。\nwrangler tail でログを確認してください。"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLabel = selectedSlot
    ? selectedSlot.rawLabel ?? `${selectedSlot.time}〜`
    : "未選択";

  return (
    <section
      id="kb-booking-section"
      className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-md sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-50 sm:text-base">
            予約枠を選ぶ
          </h3>
          <p className="text-[11px] text-slate-300 sm:text-xs">
            LINEでログインして、希望の時間をタップするだけ。
          </p>
        </div>
        <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-200">
          今日 / 明日分に対応中
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
        <button className="rounded-2xl bg-black/40 px-3 py-1 font-medium text-slate-100">
          今日
        </button>
        <button className="rounded-2xl border border-white/10 bg-black/20 px-3 py-1 text-slate-200">
          明日
        </button>
        <button
          type="button"
          onClick={handleCalendarClick}
          className="rounded-2xl border border-white/10 bg-black/10 px-3 py-1 text-slate-300"
        >
          カレンダーから選ぶ
        </button>
        {loading && (
          <span className="ml-auto text-[10px] text-slate-300">更新中…</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((slot) => {
          const isSelected =
            selectedSlot &&
            selectedSlot.time === slot.time &&
            selectedSlot.status === slot.status;

          return (
            <button
              key={(slot.slotId ?? slot.time) + slot.status}
              type="button"
              onClick={() => handleSelectSlot(slot)}
              className={`group flex flex-col items-start justify-between rounded-2xl border px-3 py-2 text-left text-xs transition hover:translate-y-0.5 hover:border-brand-gold hover:bg-black/50 active:translate-y-[1px]
              ${
                slot.status === "満席"
                  ? "border-white/10 bg-black/40 text-slate-500 cursor-not-allowed"
                  : "border-white/15 bg-black/30 text-slate-100 cursor-pointer"
              }
              ${
                isSelected
                  ? "ring-2 ring-brand-gold/70 border-brand-gold"
                  : ""
              }`}
            >
              <span className="font-semibold text-sm">{slot.time}</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] ${
                    slot.status === "満席"
                      ? "bg-slate-700 text-slate-300"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {slot.status}
                </span>
                {slot.popular && slot.status !== "満席" && (
                  <span className="rounded-full bg-brand-gold/10 px-2 py-[2px] text-[9px] text-brand-gold">
                    人気
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 選択中の枠 + 簡易フォーム */}
      <div className="mt-4 rounded-2xl bg-black/40 p-3 text-[11px] text-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-medium text-slate-100">選択中の時間</p>
            <p className="mt-0.5 text-[11px] text-slate-200">
              {selectedSlot ? selectedLabel : "まだ時間が選ばれていません。"}
            </p>
          </div>
          {selectedSlot && (
            <span className="rounded-full bg-brand-gold/10 px-3 py-1 text-[10px] text-brand-gold">
              この時間で予約を入力
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                お名前
              </span>
              <input
                type="text"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand-gold/70"
                placeholder="例）山田 花子"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                メニュー
              </span>
              <input
                type="text"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand-gold/70"
                placeholder="例）カット / カラー / 相談のみ"
                value={menu}
                onChange={(e) => setMenu(e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
              メモ
            </span>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand-gold/70"
              placeholder="気になることやご希望があればご記入ください。"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-slate-400">
              ※ このフォームは slotId が取得できた場合のみ、本番予約APIに接続されます。
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl bg-brand-gold px-4 py-2 text-[11px] font-semibold text-brand-navy shadow-soft transition hover:translate-y-0.5 hover:bg-yellow-300 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "送信中..." : "この内容で予約送信"}
            </button>
          </div>
        </form>

        <div className="mt-2 border-t border-white/10 pt-2 text-[10px] text-slate-300">
          <p className="font-medium text-slate-100">次のステップ</p>
          <ol className="mt-1 list-inside list-decimal space-y-0.5">
            <li>時間を選ぶ</li>
            <li>お名前・メニュー・メモを入力</li>
            <li>LINEで最終確認 → 予約確定</li>
          </ol>
          {error && (
            <p className="mt-2 text-[10px] text-rose-300">
              {error}
            </p>
          )}
          {submitMessage && (
            <p className="mt-1 text-[10px] text-emerald-300">
              {submitMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

// --------------------- BrandSideCard ---------------------
const BrandSideCard: React.FC = () => {
  return (
    <aside className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-slate-100 shadow-soft backdrop-blur-md sm:text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
        BRAND NOTE
      </p>
      <h3 className="mt-2 text-sm font-semibold text-slate-50">
        Kazuki Booking = ブランドとしての予約体験
      </h3>
      <p className="mt-2 text-xs text-slate-200">
        「URLを送るだけの予約フォーム」じゃなく、
        世界観・信頼感・価格帯まで伝わる“窓口”としてデザインされた予約UI。
      </p>
      <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
        <li>・白 × 深青 × 金で統一されたトーン</li>
        <li>・柔らかい角丸とソフトシャドウ</li>
        <li>・スマホ前提のレイアウトとタップしやすいカード</li>
      </ul>
      <p className="mt-3 text-[10px] text-slate-400">
        このカードは、将来的に「ブランドポリシー」「料金プラン」「実績」などに差し替え可能。
      </p>
    </aside>
  );
};

// --------------------- HowItWorks ---------------------
const HowItWorks: React.FC = () => {
  const items = [
    {
      label: "Step 1",
      title: "LINEからアクセス",
      desc: "公式LINEのメニュー or URL から予約ページへ。",
    },
    {
      label: "Step 2",
      title: "枠を選んで入力",
      desc: "空き枠をタップして、お名前とメニューを入力。",
    },
    {
      label: "Step 3",
      title: "自動通知 & 管理",
      desc: "Kazuki Booking がSlack等に通知。カレンダー連携も拡張予定。",
    },
  ];

  return (
    <section
      id="kb-howitworks-section"
      className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-md sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-50 sm:text-base">
          予約の流れ
        </h3>
        <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-200">
          3ステップ / 30秒 で完了
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-100"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
              {item.label}
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {item.title}
            </p>
            <p className="mt-1 text-[11px] text-slate-300">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

// --------------------- Footer ---------------------
const Footer: React.FC = () => {
  return (
    <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-4 text-[11px] text-slate-400 sm:flex-row">
      <p>© {new Date().getFullYear()} Kazuki Group. All rights reserved.</p>
      <p className="text-[10px] text-slate-500">
        Powered by Cloudflare Workers × LINE × 量産機 v1
      </p>
    </footer>
  );
};

export default App;
