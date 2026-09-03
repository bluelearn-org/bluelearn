import { createContext, useContext, useEffect, useState } from "react";

import type { ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "theme";

// gets theme from client - set theme before the page first renders
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
  // keeps client render consistent with server light markup - avoid hydration mismatch then applies the actual theme after hydration
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
