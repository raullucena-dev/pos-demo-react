import { useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this visit.
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? "Activar tema oscuro" : "Activar tema claro"}
      className="border-border bg-surface text-fg hover:bg-surface-2 focus-visible:outline-focus inline-flex size-9 items-center justify-center rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
