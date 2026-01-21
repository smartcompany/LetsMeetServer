// User types
export interface User {
  id: string;
  nickname: string;
  profile_image_url?: string;
  trust_score: number;
  interests: string[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Meeting types
export interface Meeting {
  id: string;
  host_id: string;
  title: string;
  description?: string;
  meeting_date: string;
  location: string;
  location_detail?: string;
  max_participants: number;
  interests: string[];
  status: 'open' | 'closed' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// Application types
export interface Application {
  id: string;
  meeting_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  applied_at: string;
  reviewed_at?: string;
}

// Attendance types
export interface Attendance {
  id: string;
  meeting_id: string;
  user_id: string;
  status: 'attended' | 'no_show' | 'cancelled';
  cancelled_at?: string;
  confirmed_at?: string;
  created_at: string;
}

// Chat types
export interface Chat {
  id: string;
  meeting_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

// User Score History types
export interface UserScoreHistory {
  id: string;
  user_id: string;
  score_change: number;
  reason: 'attendance' | 'no_show' | 'late_cancel' | 'host_experience' | 'time_recovery' | 'positive_action';
  related_meeting_id?: string;
  description?: string;
  created_at: string;
}

