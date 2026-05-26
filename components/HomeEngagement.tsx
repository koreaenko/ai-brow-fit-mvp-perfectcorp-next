"use client";

import { Mail, MessageSquare } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const VISITOR_KEY = "ai-brow-fit-visitor-stats";

type VisitorStats = {
  total: number;
  byDate: Record<string, number>;
  lastSessionDate?: string;
};

function todayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readStats(): VisitorStats {
  try {
    const raw = window.localStorage.getItem(VISITOR_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (
      parsed &&
      typeof parsed.total === "number" &&
      parsed.byDate &&
      typeof parsed.byDate === "object"
    ) {
      return parsed;
    }
  } catch {
    // Fall through to a clean local counter if the stored value is invalid.
  }

  return { total: 0, byDate: {} };
}

export default function HomeEngagement() {
  const [stats, setStats] = useState<VisitorStats>({ total: 0, byDate: {} });
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const today = useMemo(() => todayKey(), []);
  const feedbackEmail = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL ?? "";

  useEffect(() => {
    const current = readStats();
    const next = {
      total: current.total + 1,
      byDate: {
        ...current.byDate,
        [today]: (current.byDate[today] ?? 0) + 1,
      },
      lastSessionDate: today,
    };

    window.localStorage.setItem(VISITOR_KEY, JSON.stringify(next));
    window.requestAnimationFrame(() => setStats(next));
  }, [today]);

  const handleFeedbackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const body = [
      "AI Brow Fit 개선 제안",
      "",
      `이름: ${name || "미입력"}`,
      `연락처: ${contact || "미입력"}`,
      "",
      message,
    ].join("\n");

    const mailto = `mailto:${feedbackEmail}?subject=${encodeURIComponent(
      "AI Brow Fit 개선 제안",
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    setIsFeedbackOpen(false);
  };

  return (
    <div className="rounded-2xl border border-cocoa/10 bg-white/78 p-4 shadow-soft">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-cream px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cocoa/45">
            Today
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {(stats.byDate[today] ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-cream px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cocoa/45">
            Total
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {stats.total.toLocaleString()}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsFeedbackOpen(true)}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cocoa/15 bg-white text-sm font-semibold text-cocoa transition active:scale-[0.98]"
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        개선 제안하기
      </button>

      {isFeedbackOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/35 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <form
            onSubmit={handleFeedbackSubmit}
            className="w-full rounded-[24px] bg-cream p-5 shadow-soft sm:max-w-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cocoa/45">
                  Feedback
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink">개선 제안하기</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cocoa/10 bg-white text-cocoa"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="이름 또는 닉네임"
                className="h-12 w-full rounded-2xl border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-cocoa/40"
              />
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="답변 받을 이메일 또는 연락처"
                className="h-12 w-full rounded-2xl border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-cocoa/40"
              />
              <textarea
                required
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="불편했던 점이나 추가되면 좋은 기능을 적어주세요."
                className="min-h-32 w-full resize-none rounded-2xl border border-cocoa/12 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-cocoa/40"
              />
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
              <p className="text-xs leading-5 text-cocoa/55">
                전송을 누르면 이메일 앱이 열립니다.
              </p>
              <button
                type="submit"
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-cocoa px-5 text-sm font-semibold text-white"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                전송
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
