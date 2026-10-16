"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { applyTheme, storedTheme, type ThemeChoice } from "@/lib/theme";

const CHOICES: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "Match device", icon: "monitor" },
];

/**
 * Light (the default), dark, or follow the device. A per-device preference
 * (src/lib/theme.ts): a student's phone and the staff-room PC can differ.
 *
 * The server cannot know the stored choice, so the first render marks none as
 * chosen and the effect fills it in; the page itself is already themed by the
 * inline script in the root layout, so nothing flashes.
 */
export function ThemeSwitch({ withLabels = false }: { withLabels?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  useEffect(() => setChoice(storedTheme()), []);

  return (
    <div className="seg themeswitch" role="radiogroup" aria-label="Appearance">
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={choice === c.value}
          aria-label={withLabels ? undefined : c.label}
          title={c.label}
          className={choice === c.value ? "on" : undefined}
          onClick={() => {
            applyTheme(c.value);
            setChoice(c.value);
          }}
        >
          <Icon name={c.icon} size={15} />
          {withLabels && <span>{c.label}</span>}
        </button>
      ))}
    </div>
  );
}
