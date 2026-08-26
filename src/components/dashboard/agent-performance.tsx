"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadAgentPerformance } from "@/lib/dashboard/queries";
import type { AgentPerformanceRow } from "@/lib/dashboard/types";
import { SkeletonCard } from "@/components/dashboard/skeleton";
import { useTranslations } from "next-intl";

export function AgentPerformance() {
  const t = useTranslations("Dashboard.agents");
  const [rows, setRows] = useState<AgentPerformanceRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadAgentPerformance(createClient())
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((err) =>
        console.error("[dashboard] agent performance failed:", err),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <SkeletonCard />;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
      {!rows || rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t("agent")}</th>
                <th className="py-2 pr-3 font-medium">{t("assigned")}</th>
                <th className="py-2 pr-3 font-medium">{t("open")}</th>
                <th className="py-2 pr-3 font-medium">{t("resolved")}</th>
                <th className="py-2 pr-3 font-medium">{t("messages")}</th>
                <th className="py-2 font-medium">{t("avgResponse")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.user_id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2 pr-3 font-medium text-foreground">
                    {r.full_name}
                  </td>
                  <td className="py-2 pr-3">{r.assigned}</td>
                  <td className="py-2 pr-3">{r.open}</td>
                  <td className="py-2 pr-3">{r.resolved}</td>
                  <td className="py-2 pr-3">{r.messagesSent}</td>
                  <td className="py-2">
                    {r.avgResponseMinutes === null
                      ? "—"
                      : t("minutes", { m: r.avgResponseMinutes })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
