"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsFormState } from "@/lib/actions/admin/settings";

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
        {settings.map((setting) => (
          <div key={setting.key} className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">{setting.key}</label>
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
            ) : (
              <input
                type={setting.value_type === "number" ? "number" : "text"}
                name={setting.key}
                defaultValue={typeof setting.value === "string" ? setting.value : String(setting.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
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
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
