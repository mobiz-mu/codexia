"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsFormState } from "@/lib/actions/admin/settings";
import { EUR_CENTS_SETTINGS_LABELS, isEurCentsSetting } from "@/lib/config/eur-cents-settings";

type Setting = {
  key: string;
  value: unknown;
  value_type: "string" | "number" | "boolean" | "json";
  description: string | null;
};

export function SettingsForm({ settings }: { settings: Setting[] }) {
  const [state, formAction, pending] = useActionState(updateSettings, { status: "idle" } as SettingsFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {settings.map((setting) => {
          const eurCents = isEurCentsSetting(setting.key);
          return (
            <div key={setting.key} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">
                {eurCents ? EUR_CENTS_SETTINGS_LABELS[setting.key] : setting.key}
              </label>
              {eurCents && <p className="text-xs text-muted">Key: {setting.key} (EUR)</p>}
              {setting.description && <p className="text-xs text-muted">{setting.description}</p>}
              {setting.value_type === "boolean" ? (
                <select
                  name={setting.key}
                  defaultValue={String(setting.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : eurCents ? (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name={setting.key}
                    defaultValue={(Number(setting.value ?? 0) / 100).toFixed(2)}
                    className="w-full rounded-lg border border-border px-3 py-2 pl-7 text-sm"
                  />
                </div>
              ) : (
                <input
                  type={setting.value_type === "number" ? "number" : "text"}
                  name={setting.key}
                  defaultValue={typeof setting.value === "string" ? setting.value : String(setting.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.status === "success" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
