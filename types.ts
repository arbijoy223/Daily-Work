
export interface TaskTemplate {
  id: string;
  name: string;
  points: number;
}

export interface TaskInstance extends TaskTemplate {
  completed: boolean;
}

export interface DailyRecord {
  date: string; // ISO string (YYYY-MM-DD)
  tasks: TaskInstance[];
  totalPointsEarned: number;
  maxPointsPossible: number;
  customQuote?: string;
  reportComment?: string;
  prayers?: {
    fajr: boolean;
    dhuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
  };
}

export interface UserProfile {
  name: string;
  avatar: string;
  totalPoints: number;
  streak: number;
}

export interface AppState {
  profile: UserProfile;
  templates: TaskTemplate[];
  records: Record<string, DailyRecord>; // Keyed by YYYY-MM-DD
  darkMode: boolean;
}
