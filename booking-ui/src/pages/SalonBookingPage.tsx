import React, { useState, useEffect } from "react";
import BookingLayout from "../components/BookingLayout";
import { BookingCard } from "../components/BookingCard";
import { PrimaryButton } from "../components/PrimaryButton";

type Slot = {
  id: string;
  label: string;
  note?: string;
  status: "available" | "booked";
};

const mockSlots: Slot[] = [
  { id: "s-10-00", label: "10:00", note: "空きあり", status: "available" },
  { id: "s-12-00", label: "12:00", note: "空きあり", status: "available" },
  { id: "s-15-00", label: "15:00", note: "残りわずか", status: "available" },
  { id: "s-18-00", label: "18:00", note: "空きあり", status: "available" },
];

const API_BASE =
  import.meta.env.VITE_BOOKING_API_BASE ||
  "https://saas-api.hekuijincun.workers.dev";

const SalonBookingPage: React.FC = () => {
  const [selectedMenuId, setSelectedMenuId] = useState<string>("menu-cut-color");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [slots, setSlots] = useState<Slot[]>(mockSlots);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [reserveMessage, setReserveMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setIsLoadingSlots(true);
        setSlotsError(null);

        const res = await fetch(API_BASE + "/line/slots", {
          method: "GET",
        });

        if (!res.ok) {
          throw new Error("Failed to load slots: " + res.status);
        }

        const data = await res.json();

        const rawSlots: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any).slots)
          ? (data as any).slots
          : [];

        if (!rawSlots.length) {
          console.warn("[BookingUI] /line/slots returned empty slots.", data);
          setSlots(mockSlots);
          return;
        }

        const mapped: Slot[] = rawSlots.map(function (s: any, index: number) {
          const id = s.slotId ?? s.id ?? String(index);
          const label =
            s.label ??
            s.time ??
            s.startsAt ??
            s.startTime ??
            ("枠 " + String(index + 1));
          const isBooked =
            (s.isBooked as boolean | undefined) ??
            (s.booked as boolean | undefined) ??
            (s.available === false);

          return {
            id: id,
            label: label,
            note: !isBooked ? s.note ?? "空きあり" : s.note ?? "予約済み",
            status: isBooked ? "booked" : "available",
          };
        });

        setSlots(mapped);
      } catch (err) {
        console.error("[BookingUI] Failed to fetch slots:", err);
        setSlotsError(
          "ただいま予約枠の取得に失敗しました。時間をおいて再度お試しください。"
        );
        setSlots(mockSlots); // フォールバックでモック使用
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, []);

  const handleReserveClick = async () => {
    if (!selectedSlotId) {
      alert("ご希望の時間帯を選択してください。");
      return;
    }

    setIsSubmitting(true);
    setReserveMessage(null);

    try {
      const body = {
        slotId: selectedSlotId,
        menuId: selectedMenuId,
        source: "web-ui",
      };

      const res = await fetch(API_BASE + "/line/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // JSONじゃない場合もあるので無視
      }

      if (!res.ok) {
        console.error("[BookingUI] reserve failed:", res.status, text);
        setReserveMessage(
          "予約の処理中にエラーが発生しました。LINEからの予約は問題なくご利用いただけます。"
        );
        return;
      }

      const reservationId =
        (json && json.reservationId) ??
        (json && json.id) ??
        (json && json.data && json.data.id) ??
        null;

      setReserveMessage(
        reservationId
          ? "ご予約を受け付けました。（予約ID: " + reservationId + "）"
          : "ご予約を受け付けました。ありがとうございます。"
      );
    } catch (err) {
      console.error("[BookingUI] reserve error:", err);
      setReserveMessage(
        "ネットワークエラーにより予約できませんでした。時間をおいて再度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BookingLayout
      title="Luxe Hair Tokyo ご予約"
      subtitle="カット / カラー / トリートメントを、24時間いつでもオンライン予約。"
    >
      {/* メニュー選択 */}
      <BookingCard
        title="メニューを選択"
        description="ご希望のメニューと担当スタイリストをお選びください。"
      >
        <div className="space-y-2 text-sm">
          <button
            type="button"
            onClick={function () {
              setSelectedMenuId("menu-cut-color");
            }}
            className={
              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition " +
              (selectedMenuId === "menu-cut-color"
                ? "border-kb-navy bg-white shadow-kb-subtle"
                : "border-kb-border bg-kb-bg hover:border-kb-navy/70")
            }
          >
            <div>
              <div className="font-medium text-kb-textMain">
                カット＋カラー
              </div>
              <div className="text-xs text-kb-textMuted">目安時間：120分</div>
            </div>
            <div className="text-right text-sm font-semibold text-kb-navy">
              ¥13,200
            </div>
          </button>
        </div>
      </BookingCard>

      {/* 日時を選択（API + フォールバック） */}
      <BookingCard
        title="日時を選択"
        description={
          slotsError ??
          "ご希望の時間帯をタップしてください。※枠は自動更新されます。"
        }
      >
        {isLoadingSlots && (
          <div className="mb-3 text-xs text-kb-textMuted">
            予約枠を読み込み中です…
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {slots.map(function (slot) {
            const isSelected = slot.id === selectedSlotId;
            const isDisabled = slot.status === "booked";

            return (
              <button
                key={slot.id}
                type="button"
                disabled={isDisabled}
                onClick={function () {
                  setSelectedSlotId(slot.id);
                }}
                className={
                  "flex flex-col items-center justify-center rounded-2xl border px-3 py-3 text-sm transition " +
                  (isDisabled
                    ? "cursor-not-allowed border-kb-border bg-kb-bg text-kb-textMuted opacity-60"
                    : isSelected
                    ? "border-kb-navy bg-kb-navy text-white shadow-kb-subtle"
                    : "border-kb-border bg-white text-kb-textMain hover:border-kb-navy/70 hover:shadow-kb-subtle")
                }
              >
                <span className="text-sm font-semibold">{slot.label}</span>
                {slot.note && (
                  <span
                    className={
                      "mt-1 text-[11px] " +
                      (isSelected ? "text-kb-goldSoft" : "text-kb-textMuted")
                    }
                  >
                    {slot.note}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {reserveMessage && (
          <div className="mt-3 text-xs text-kb-textMuted">
            {reserveMessage}
          </div>
        )}

        <PrimaryButton
          fullWidth
          onClick={handleReserveClick}
          disabled={isSubmitting}
          className={isSubmitting ? "opacity-80" : ""}
        >
          {isSubmitting
            ? "予約処理中..."
            : selectedSlotId
            ? "この内容で予約を確定する"
            : "時間帯を選んで予約に進む"}
        </PrimaryButton>
      </BookingCard>
    </BookingLayout>
  );
};

export default SalonBookingPage;
