import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const getScheduledTheme = (): Theme => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? "light" : "dark";
  };
  const readManualTheme = (): Theme | null => {
    try {
      const saved = localStorage.getItem("studyverse-theme-preference");
      return saved === "light" || saved === "dark" ? saved : null;
    } catch {
      return null;
    }
  };
  const [manualTheme, setManualTheme] = useState<Theme | null>(() => readManualTheme());
  const [theme, setTheme] = useState<Theme>(() => {
    return readManualTheme() ?? getScheduledTheme();
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (!manualTheme) {
      const syncTheme = () => setTheme(getScheduledTheme());
      syncTheme();
      const timer = window.setInterval(syncTheme, 60_000);
      return () => window.clearInterval(timer);
    }
  }, [theme, manualTheme]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => {
          const next = prev === "light" ? "dark" : "light";
          setManualTheme(next);
          try { localStorage.setItem("studyverse-theme-preference", next); } catch { /* 保存不可の環境では現在の表示だけ切り替える */ }
          return next;
        });
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
