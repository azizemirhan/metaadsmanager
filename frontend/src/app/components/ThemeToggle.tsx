'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const options: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Açık', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Koyu', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'Sistem', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
            transition-all duration-200
            ${theme === option.value
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }
          `}
          title={option.label}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

// Basit versiyon - sadece toggle
export function ThemeToggleSimple() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="
        p-2 rounded-lg
        bg-slate-100 dark:bg-slate-800
        text-slate-600 dark:text-slate-400
        hover:bg-slate-200 dark:hover:bg-slate-700
        hover:text-slate-900 dark:hover:text-white
        transition-colors duration-200
      "
      title={resolvedTheme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
