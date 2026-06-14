import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dojo' | 'dojo-dark';

const THEME_KEY = 'preferredTheme';
const VALID_THEMES: AppTheme[] = ['dojo', 'dojo-dark'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly currentTheme = signal<AppTheme>(this.getSavedTheme());

  constructor() {
    this.applyTheme(this.currentTheme());
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    localStorage.setItem(THEME_KEY, theme);
    this.applyTheme(theme);
  }

  private getSavedTheme(): AppTheme {
    const saved = localStorage.getItem(THEME_KEY);
    // Migrate old theme values
    if (saved === 'light') return 'dojo';
    if (saved === 'dark') return 'dojo-dark';
    return saved && VALID_THEMES.includes(saved as AppTheme) ? saved as AppTheme : 'dojo-dark';
  }

  private applyTheme(theme: AppTheme): void {
    document.body.style.colorScheme = theme === 'dojo' ? 'light' : 'dark';
    document.body.classList.remove('theme-dojo', 'theme-dojo-dark');
    document.body.classList.add(`theme-${theme}`);
  }
}
