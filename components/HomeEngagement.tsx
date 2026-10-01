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
    <div className="engagement">
      <div className="engagement-counts" title="이 브라우저의 방문 기록">
        <span>Today<strong>{(stats.byDate[today] ?? 0).toLocaleString()}</strong></span>
        <span>Total<strong>{stats.total.toLocaleString()}</strong></span>
      </div>
        <a
          href={FEEDBACK_FORM_URL}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          개선 제안하기
        </a>
    </div>
  );
}
