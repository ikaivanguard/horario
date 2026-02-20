export interface User {
  id: number;
  username: string;
  code: string;
}

export interface Feedback {
  id: number;
  title: string;
  category: string;
  description: string;
  status: 'Pendiente' | 'En Revisión' | 'Implementada';
  user_id: number;
  username?: string;
  created_at: string;
}

export interface ScheduleBlock {
  id: number;
  day: number;
  hour: number;
  user_id: number;
  username?: string;
}
