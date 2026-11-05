export type Role = 'student' | 'professor';
export type Kind = 'regular' | 'anytime';
export type Period = 'start' | 'end' | 'vac';
export type Mode = 'request' | 'done';
export type RefStatus = 'none' | 'advised' | 'linked' | 'closed';
export type Enroll = '재학' | '휴학' | '자퇴·제적' | '졸업';

export interface Profile {
  id: string;
  role: Role;
  name: string;
  student_no: string | null;
  dept: string | null;
  grade: number | null;
  phone: string | null;
  created_at: string;
}

export interface Entry {
  id: string;
  student_id: string;
  term: string;
  kind: Kind;
  period: Period | null;
  mode: Mode;
  date: string;
  time_pref: string | null;
  checks: string[];
  message: string | null;
  student_done_at: string | null;
  prof_done_at: string | null;
  created_at: string;
}

export interface Referral {
  student_id: string;
  status: RefStatus;
  changed_at: string;
}

export interface AdvisorNote {
  student_id: string;
  enroll_status: Enroll;
  memo: string;
}

export interface Settings {
  id: number;
  prof_name: string;
  center_info: string;
}
