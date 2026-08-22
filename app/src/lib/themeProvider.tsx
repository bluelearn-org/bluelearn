import { createContext, useContext, useEffect, useState } from "react";

import type { ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "theme";

/**
 * The theme the document is *actually* rendering with. The inline script in
 * `__root.tsx` resolves this same value and applies the `dark` class before
 * first paint, so this only re-derives it for React's benefit. Client-only —
 * it touches `localStorage` and `matchMedia`.
 */
function resolveTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === "dark" || saved === "light") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The server has no way to know the visitor's theme, so it always renders
  // the "light" markup. The first client render has to agree with that markup:
  // React does not repair mismatched attributes while hydrating, so seeding
  // this from the DOM left theme-dependent controls stuck on their
  // server-rendered state (#327). The real theme is applied in the effect
  // below, after hydration, where a genuine state change can re-render them.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setTheme(resolveTheme());
  }, []);

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);

    document.documentElement.classList.toggle("dark", newTheme === "dark");

    localStorage.setItem(STORAGE_KEY, newTheme);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);

  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return ctx;
}
