// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "@/lib/themeProvider";

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const mockPrefersDark = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    writable: true,
    configurable: true,
  });
};

/**
 * Records the theme seen on every render so we can assert on the *first* one,
 * which is the render that has to match the server-generated markup.
 */
function renderThemes() {
  const themes: Array<string> = [];
  let setTheme: (theme: "light" | "dark") => void = () => {};

  function Probe() {
    const ctx = useTheme();
    themes.push(ctx.theme);
    setTheme = ctx.setTheme;
    return null;
  }

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );

  return { themes, setTheme: (theme: "light" | "dark") => setTheme(theme) };
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createLocalStorageMock(),
      writable: true,
      configurable: true,
    });
    document.documentElement.classList.remove("dark");
    mockPrefersDark(false);
  });

  // Regression test for #327: the footer toggle rendered "off" on a dark-mode
  // load because the provider seeded its state from the DOM. That disagreed
  // with the server markup, and React does not repair mismatched attributes
  // while hydrating.
  it("renders light on the first pass so it matches the server markup", () => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");

    const { themes } = renderThemes();

    expect(themes[0]).toBe("light");
  });

  it("adopts the stored theme once effects have run", () => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");

    const { themes } = renderThemes();

    expect(themes.at(-1)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to the system preference when nothing is stored", () => {
    mockPrefersDark(true);

    const { themes } = renderThemes();

    expect(themes.at(-1)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("stays light when neither storage nor the system asks for dark", () => {
    const { themes } = renderThemes();

    expect(themes.at(-1)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("ignores an unrecognised stored value", () => {
    localStorage.setItem("theme", "sepia");
    mockPrefersDark(true);

    const { themes } = renderThemes();

    expect(themes.at(-1)).toBe("dark");
  });

  it("persists and applies the theme when it is changed", () => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");

    const { setTheme } = renderThemes();

    act(() => setTheme("light"));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
