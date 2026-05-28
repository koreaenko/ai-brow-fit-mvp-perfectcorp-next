"use client";

import { MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const VISITOR_KEY = "ai-brow-fit-visitor-stats";
const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScTBCpXjstDVPgpORxVaTGQ9cqcP5ZW7PHb7xRMz_7k7xC3qg/viewform?usp=publish-editor";

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
  const today = useMemo(() => todayKey(), []);

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

  return (
    <div className="rounded-[18px] border border-white/14 bg-black/16 px-3 py-2 text-white backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="min-w-12 rounded-[13px] bg-white/8 px-2.5 py-1.5 ring-1 ring-white/8">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Today
          </p>
          <p className="text-sm font-semibold leading-4 text-white">
            {(stats.byDate[today] ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="min-w-12 rounded-[13px] bg-white/8 px-2.5 py-1.5 ring-1 ring-white/8">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Total
          </p>
          <p className="text-sm font-semibold leading-4 text-white">
            {stats.total.toLocaleString()}
          </p>
        </div>
        <a
          href={FEEDBACK_FORM_URL}
          className="ml-auto flex h-9 items-center justify-center gap-1.5 rounded-[13px] bg-white/14 px-3 text-xs font-semibold text-white ring-1 ring-white/12 transition active:scale-[0.98]"
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          개선 제안하기
        </a>
      </div>
    </div>
  );
}
