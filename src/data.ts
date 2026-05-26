import { Employee, LeaveRecord, Role, LeaveType, SecurityLog } from './types';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: '姚柏楊',
    role: 'CLEANER',
    password: '1234',
    color: '#ef4444', // Red
    textColor: '#ffffff',
    bgColor: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    id: 'emp-2',
    name: '陳僑鴻',
    role: 'CLEANER',
    password: '1234',
    color: '#f97316', // Orange
    textColor: '#ffffff',
    bgColor: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    id: 'emp-3',
    name: '莊易霖',
    role: 'CLEANER',
    password: '1234',
    color: '#84cc16', // Lime/Yellow-green
    textColor: '#ffffff',
    bgColor: 'bg-lime-50 text-lime-700 border-lime-200',
  },
  {
    id: 'emp-4',
    name: '吳士榮',
    role: 'PART_TIME',
    password: '1234',
    color: '#10b981', // Emerald green
    textColor: '#ffffff',
    bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'emp-5',
    name: '諸葛秀玲',
    role: 'PART_TIME',
    password: '1234',
    color: '#06b6d4', // Cyan
    textColor: '#ffffff',
    bgColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    id: 'emp-6',
    name: '薇氏秋青',
    role: 'PART_TIME',
    password: '1234',
    color: '#3b82f6', // Blue
    textColor: '#ffffff',
    bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'emp-7',
    name: '王美淇',
    role: 'MANAGER',
    password: '1234',
    color: '#8b5cf6', // Indigo/Purple
    textColor: '#ffffff',
    bgColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    id: 'emp-8',
    name: '黃雅歆',
    role: 'RECEPTION',
    password: '1234',
    color: '#ec4899', // Pink
    textColor: '#ffffff',
    bgColor: 'bg-pink-50 text-pink-700 border-pink-200',
  },
  {
    id: 'emp-9',
    name: '王茜郁',
    role: 'RECEPTION',
    password: '1234',
    color: '#ca8a04', // Amber/Brick orange
    textColor: '#ffffff',
    bgColor: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    id: 'emp-10',
    name: '系統管理員',
    role: 'ADMIN',
    password: '1234',
    color: '#64748b', // Slate grey
    textColor: '#ffffff',
    bgColor: 'bg-slate-100 text-slate-800 border-slate-300',
  },
];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: '管理員',
  CLEANER: '外勤人員',
  RECEPTION: '櫃台人員',
  PART_TIME: '工讀生',
  MANAGER: '主管',
};

export const ROLE_BADGES: Record<Role, string> = {
  ADMIN: 'bg-slate-100 text-slate-800 border-slate-300',
  CLEANER: 'bg-red-50 text-red-700 border-red-200',
  RECEPTION: 'bg-pink-50 text-pink-700 border-pink-200',
  PART_TIME: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MANAGER: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const LEAVE_COLORS: Record<LeaveType, { bg: string; text: string; dot: string; border: string }> = {
  '排休': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200' },
};

// Preset holidays for Taiwan or simple visual tags (Year 2026 support)
export const TAIWAN_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': '元旦',
  '2026-02-16': '春節連假',
  '2026-02-17': '春節除夕',
  '2026-02-18': '春節初一',
  '2026-02-19': '春節初二',
  '2026-02-20': '春節初三',
  '2026-02-21': '春節初四',
  '2026-02-22': '春節初五',
  '2026-02-27': '二二八連假',
  '2026-02-28': '和平紀念日',
  '2026-04-03': '清明連假',
  '2026-04-04': '兒童節',
  '2026-04-05': '清明節',
  '2026-05-01': '勞動節',
  '2026-06-19': '端午節',
  '2026-09-25': '中秋節',
  '2026-10-10': '國慶日',
};

export const INITIAL_LEAVE_RECORDS: LeaveRecord[] = [
  {
    id: 'lr-1',
    employeeId: 'emp-1', // 姚柏楊
    employeeName: '姚柏楊',
    role: 'CLEANER',
    date: '2026-05-04',
    type: '排休',
    note: '家庭旅遊',
  },
  {
    id: 'lr-2',
    employeeId: 'emp-2', // 陳僑鴻
    employeeName: '陳僑鴻',
    role: 'CLEANER',
    date: '2026-05-11',
    type: '排休',
    note: '處理私事',
  },
  {
    id: 'lr-3',
    employeeId: 'emp-5', // 諸葛秀玲
    employeeName: '諸葛秀玲',
    role: 'PART_TIME',
    date: '2026-05-11',
    type: '排休',
    note: '感冒就醫',
  },
  {
    id: 'lr-4',
    employeeId: 'emp-7', // 王美淇
    employeeName: '王美淇',
    role: 'MANAGER',
    date: '2026-05-15',
    type: '排休',
    note: '總部會議',
  },
  {
    id: 'lr-5',
    employeeId: 'emp-8', // 黃雅歆
    employeeName: '黃雅歆',
    role: 'RECEPTION',
    date: '2026-05-20',
    type: '排休',
    note: '特休假',
  },
  {
    id: 'lr-6',
    employeeId: 'emp-4', // 吳士榮
    employeeName: '吳士榮',
    role: 'PART_TIME',
    date: '2026-05-25',
    type: '排休',
    note: '學校活動',
  },
  {
    id: 'lr-7',
    employeeId: 'emp-3', // 莊易霖
    employeeName: '莊易霖',
    role: 'CLEANER',
    date: '2026-05-26',
    type: '排休',
    note: '返鄉探親',
  },
];

export const INITIAL_SECURITY_LOGS: SecurityLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-05-25T08:00:00.000Z',
    operator: '系統記錄',
    action: '系統初始化',
    details: '團隊排休系統初始載入完畢，預設10位員工及7筆休假記錄。',
  },
];
