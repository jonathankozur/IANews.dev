"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();

    // useEffect only runs on the client, so now we can safely show the UI
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9" />; // Placeholder to avoid layout shift
    }

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle Dark Mode"
        >
            {theme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-500" />
            ) : (
                <Moon className="h-5 w-5 text-slate-700" />
            )}
        </button>
    );
}
