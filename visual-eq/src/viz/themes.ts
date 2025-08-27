// Theme configurations for MVP
export interface Theme {
  name: string;
  background: string;
  barColors: string[];
  textColor: string;
  controlBackground: string;
  controlBorder: string;
}

export const themes: Record<'light' | 'dark', Theme> = {
  dark: {
    name: 'Dark',
    background: '#000000',
    barColors: ['#1e40af', '#059669', '#d97706', '#dc2626'], // blue → green → amber → red
    textColor: '#ffffff',
    controlBackground: '#1f2937',
    controlBorder: '#374151'
  },
  
  light: {
    name: 'Light', 
    background: '#f8fafc',
    barColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'], // blue → green → amber → red
    textColor: '#1f2937',
    controlBackground: '#ffffff',
    controlBorder: '#d1d5db'
  }
};

export type ThemeType = keyof typeof themes;