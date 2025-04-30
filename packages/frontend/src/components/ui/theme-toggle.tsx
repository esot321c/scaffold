import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/providers/theme-provider";
import { useEffect, useState } from "react";
import { Button } from "./button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("light");

  // Determine the actual current theme (resolving "system" if needed)
  useEffect(() => {
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      setCurrentTheme(systemTheme);
    } else {
      setCurrentTheme(theme as "dark" | "light");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      onClick={toggleTheme}
      variant="outline"
      aria-label={
        currentTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme"
      }
    >
      {currentTheme === "dark" ? (
        <Sun className="h-5 w-5 text-current" />
      ) : (
        <Moon className="h-5 w-5 text-current" />
      )}
    </Button>
  );
}
