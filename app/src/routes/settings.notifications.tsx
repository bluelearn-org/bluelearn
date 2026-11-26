import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { NotificationType } from "@bluelearn/schemas";

import {
  getNotificationPreferences,
  setNotificationPreference,
} from "@/lib/api/notifications";
import {
  isNotificationTypeLive,
  notificationSections,
} from "@/lib/notifications";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings/notifications")({
  component: RouteComponent,
});

function RouteComponent() {
  const [enabled, setEnabled] = useState<Partial<
    Record<NotificationType, boolean>
  > | null>(null);
  const [saving, setSaving] = useState<Set<NotificationType>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getNotificationPreferences({ signal: controller.signal })
      .then((preferences) =>
        setEnabled(
          Object.fromEntries(preferences.map((p) => [p.type, p.enabled]))
        )
      )
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error(cause);
        setError("Could not load your notification settings.");
      });

    return () => controller.abort();
  }, []);

  const toggle = async (type: NotificationType, next: boolean) => {
    setEnabled((current) => ({ ...current, [type]: next }));
    setSaving((current) => new Set(current).add(type));
    setError(null);

    try {
      await setNotificationPreference(type, next);
    } catch (cause) {
      console.error(cause);
      setEnabled((current) => ({ ...current, [type]: !next }));
      setError("Could not save that change. Try again.");
    } finally {
      setSaving((current) => {
        const rest = new Set(current);
        rest.delete(type);
        return rest;
      });
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          Notifications
        </h1>
      </div>

      <Separator className="mb-8 bg-border" />

      {error && (
        <p role="alert" className="mb-6 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="max-w-3xl space-y-10">
        {notificationSections.map((section) => (
          <section key={section.category} aria-labelledby={section.category}>
            <h2
              id={section.category}
              className="mb-4 font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase"
            >
              {section.label}
            </h2>

            <ul className="divide-y rounded-lg border">
              {section.types.map(({ type, label }) => {
                const live = isNotificationTypeLive(type);
                const id = `notification-${type}`;

                return (
                  <li
                    key={type}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <label htmlFor={id} className="text-sm">
                      {label}
                      {!live && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Coming soon
                        </span>
                      )}
                    </label>
                    <Switch
                      id={id}
                      checked={enabled?.[type] ?? false}
                      disabled={!live || enabled === null || saving.has(type)}
                      onCheckedChange={(next) => toggle(type, next)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
