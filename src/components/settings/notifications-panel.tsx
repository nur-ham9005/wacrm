"use client";

import { Bell, BellOff } from "lucide-react";

import { useTranslations } from "next-intl";
import { SettingsPanelHead } from "./settings-panel-head";
import { Switch } from "@/components/ui/switch";
import { useNotificationSound } from "@/hooks/use-notification-sound";

/**
 * Notifications panel — controls for in-app sound alerts.
 *
 * Currently a single toggle: play a chime when an inbound customer
 * message arrives. Device-scoped (localStorage), like appearance.
 */
export function NotificationsPanel() {
  const t = useTranslations("Settings.notifications");
  const { muted, setMuted } = useNotificationSound();

  return (
    <section className="max-w-3xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            {muted ? (
              <BellOff className="mt-0.5 size-4 text-muted-foreground" />
            ) : (
              <Bell className="mt-0.5 size-4 text-muted-foreground" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("incomingSoundTitle")}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("incomingSoundDesc")}
              </p>
            </div>
          </div>
          <Switch
            checked={!muted}
            onCheckedChange={(checked) => setMuted(!checked)}
            aria-label={t("incomingSoundTitle")}
          />
        </div>
      </div>
    </section>
  );
}
