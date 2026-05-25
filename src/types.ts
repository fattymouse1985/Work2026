export type Role = 'ADMIN' | 'CLEANER' | 'RECEPTION' | 'PART_TIME' | 'MANAGER';

export type LeaveType = '排休';

export interface Employee {
  id: string; // Typically name or short ID
  name: string;
  role: Role;
  password: string;
  color: string; // Hex color for calendar
  textColor: string; // Best contrast text color
  bgColor: string; // Tailwind bg color preview
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: Role;
  date: string; // YYYY-MM-DD
  type: LeaveType;
  note: string;
}

export interface SecurityLog {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  details: string;
}

export interface GistConfig {
  githubToken: string;
  gistId: string;
  lastSynced: string;
  status: 'UNCONFIGURED' | 'CONNECTED' | 'ERROR';
}
