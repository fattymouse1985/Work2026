import React, { useState, useEffect, useRef } from 'react';
import { Employee, LeaveRecord, SecurityLog, Role, LeaveType } from './types';
import {
  INITIAL_EMPLOYEES,
  INITIAL_LEAVE_RECORDS,
  INITIAL_SECURITY_LOGS,
  ROLE_LABELS,
  ROLE_BADGES,
  LEAVE_COLORS,
  TAIWAN_HOLIDAYS_2026
} from './data';

// Import our modular sub-components
import SecurityLogsModal from './components/SecurityLogsModal';
import EmployeeManager from './components/EmployeeManager';

// Import icons
import {
  Calendar as CalendarIcon,
  Table as TableIcon,
  Plus,
  Trash2,
  Settings,
  Download,
  Upload,
  Github,
  LogIn,
  LogOut,
  User,
  Lock,
  ShieldAlert,
  List,
  FileText,
  Printer,
  RefreshCcw,
  CheckCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Info,
  Edit,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Clock,
  Sparkle
} from 'lucide-react';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ============================================================================
// 【雲端 Google Sheets 自動雙向同步配置區】
// 透過環境變數 (.env) VITE_API_URL 帶入 Google Apps Script 佈署網址。
// ============================================================================
const apiUrl = import.meta.env.VITE_API_URL || '';

export default function App() {
  // -------------------------------------------------------------
  // 1. Core Reactive States & LocalStorage Persistence
  // -------------------------------------------------------------
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('team_scheduling_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(() => {
    const saved = localStorage.getItem('team_scheduling_leaves');
    return saved ? JSON.parse(saved) : INITIAL_LEAVE_RECORDS;
  });

  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>(() => {
    const saved = localStorage.getItem('team_scheduling_logs');
    return saved ? JSON.parse(saved) : INITIAL_SECURITY_LOGS;
  });

  const [status, setStatus] = useState<string>('試算表連線中...');
  const [lastSynced, setLastSynced] = useState<string>(() => {
    return localStorage.getItem('team_scheduling_last_synced') || '';
  });

  // Default logged in user: null, to enforce login view first upon visit (except when saved session exists)
  const [currentLoginUser, setCurrentLoginUser] = useState<Employee | null>(() => {
    const saved = localStorage.getItem('team_scheduling_login_user');
    if (saved) {
      return JSON.parse(saved);
    }
    return null; // Require login initially
  });

  // 使用 useRef 鎖定最新的狀態，避免輪詢或背景同步時抓到舊的 state
  const employeesRef = useRef(employees);
  const leaveRecordsRef = useRef(leaveRecords);
  const securityLogsRef = useRef(securityLogs);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    leaveRecordsRef.current = leaveRecords;
  }, [leaveRecords]);

  useEffect(() => {
    securityLogsRef.current = securityLogs;
  }, [securityLogs]);

  const loadLocalBackup = () => {
    const localEmp = localStorage.getItem('team_scheduling_employees');
    const localLeave = localStorage.getItem('team_scheduling_leaves');
    const localLogs = localStorage.getItem('team_scheduling_logs');
    if (localEmp) setEmployees(JSON.parse(localEmp));
    if (localLeave) setLeaveRecords(JSON.parse(localLeave));
    if (localLogs) setSecurityLogs(JSON.parse(localLogs));
  };

  // 1. 核心功能 1：從雲端試算表「下載並讀取」最新資料的函式
  const loadDataFromSheets = async (isBackground = false) => {
    if (!apiUrl) return;
    try {
      if (!isBackground) {
        setStatus('雲端資料同步中...');
      }
      
      const response = await fetch(apiUrl);
      const cloudData = await response.json();
      
      if (cloudData) {
        // A. 處理員工名單
        if (cloudData.EMPLOYEES && Array.isArray(cloudData.EMPLOYEES)) {
          if (JSON.stringify(cloudData.EMPLOYEES) !== JSON.stringify(employeesRef.current)) {
            setEmployees(cloudData.EMPLOYEES);
          }
        }
        
        // B. 處理假單紀錄
        let parsedLeaves: LeaveRecord[] = [];
        if (cloudData.LEAVE_RECORDS) {
          if (Array.isArray(cloudData.LEAVE_RECORDS)) {
            parsedLeaves = cloudData.LEAVE_RECORDS;
          } else if (typeof cloudData.LEAVE_RECORDS === 'object') {
            const flatLeaves: LeaveRecord[] = [];
            Object.entries(cloudData.LEAVE_RECORDS).forEach(([empName, records]) => {
              const emp = employeesRef.current.find(e => e.name === empName);
              if (Array.isArray(records)) {
                records.forEach((rec: any, idx: number) => {
                  flatLeaves.push({
                    id: rec.id || `lr-${empName}-${rec.date}-${idx}`,
                    employeeId: emp?.id || empName,
                    employeeName: empName,
                    role: emp?.role || 'CLEANER',
                    date: rec.date,
                    type: rec.type || '排休',
                    note: rec.note || '',
                  });
                });
              }
            });
            parsedLeaves = flatLeaves;
          }
        }
        
        if (JSON.stringify(parsedLeaves) !== JSON.stringify(leaveRecordsRef.current)) {
          setLeaveRecords(parsedLeaves);
        }

        // C. 處理操作日誌
        if (cloudData.SECURITY_LOGS && Array.isArray(cloudData.SECURITY_LOGS)) {
          if (JSON.stringify(cloudData.SECURITY_LOGS) !== JSON.stringify(securityLogsRef.current)) {
            setSecurityLogs(cloudData.SECURITY_LOGS);
          }
        }
        
        const syncTime = new Date().toLocaleString();
        setLastSynced(syncTime);
        localStorage.setItem('team_scheduling_last_synced', syncTime);
        setStatus('Google 試算表雙軌同步已連線 (CONNECTED)');
      } else {
        if (!isBackground) {
          loadLocalBackup();
          setStatus('試算表無資料，已載入本地暫存');
        }
      }
    } catch (error) {
      console.error("背景自動讀取失敗:", error);
      if (!isBackground) {
        loadLocalBackup();
        setStatus('連線失敗，已切換至離線暫存模式');
      }
    }
  };

  // 2. 核心功能 2：網頁初始化，並設定「每 3 秒自動下載更新」的定時器
  useEffect(() => {
    // 優先讀取登入狀態
    const savedUser = localStorage.getItem('team_scheduling_login_user');
    if (savedUser) setCurrentLoginUser(JSON.parse(savedUser));

    // 1. 網頁一打開，立刻進行第一次完整下載
    loadDataFromSheets(false);

    // 2. ⚡ 開啟每 3 秒自動背景下載機制 (設定為 3000 毫秒最穩定，不易被 Google 封鎖限制)
    const intervalId = setInterval(() => {
      loadDataFromSheets(true); // 傳入 true 默默刷新
    }, 3000);

    // 當網頁關閉時清除定時器
    return () => clearInterval(intervalId);
  }, [apiUrl]);

  // Sync state to localstorage when changes occur
  useEffect(() => {
    localStorage.setItem('team_scheduling_employees', JSON.stringify(employees));
    
    // 每當員工名單變更，自動上傳一份備份到 Google Sheets
    if (import.meta.env.VITE_API_URL) {
      fetch(import.meta.env.VITE_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ALL_DATA_BACKUP', // 這裡設定一個全域存檔名
          data: employees
        })
      }).catch(err => console.error("同步至試算表失敗:", err));
    }
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('team_scheduling_leaves', JSON.stringify(leaveRecords));
  }, [leaveRecords]);

  useEffect(() => {
    localStorage.setItem('team_scheduling_logs', JSON.stringify(securityLogs));
  }, [securityLogs]);

  useEffect(() => {
    if (currentLoginUser) {
      localStorage.setItem('team_scheduling_login_user', JSON.stringify(currentLoginUser));
    } else {
      localStorage.removeItem('team_scheduling_login_user');
    }
  }, [currentLoginUser]);

  // -------------------------------------------------------------
  // 2. Auxiliary UI / View States & Row-level Security Filter Helpers
  // -------------------------------------------------------------
  const getVisibleEmployees = (): Employee[] => {
    if (!currentLoginUser) {
      return employees;
    }
    const role = currentLoginUser.role;
    if (role === 'ADMIN' || role === 'MANAGER') {
      return employees;
    }
    if (role === 'CLEANER') {
      // Cleaners only see cleaners
      return employees.filter((e) => e.role === 'CLEANER');
    }
    if (role === 'PART_TIME') {
      // Part-timers only see themselves
      return employees.filter((e) => e.id === currentLoginUser.id);
    }
    if (role === 'RECEPTION') {
      // Reception sees reception and managers
      return employees.filter((e) => e.role === 'RECEPTION' || e.role === 'MANAGER');
    }
    return employees;
  };

  const getVisibleLeaveRecords = (): LeaveRecord[] => {
    const visibleEmps = getVisibleEmployees();
    const visibleEmpIds = new Set(visibleEmps.map((e) => e.id));
    return leaveRecords.filter((lr) => visibleEmpIds.has(lr.employeeId));
  };

  const visibleEmployees = getVisibleEmployees();
  const visibleLeaveRecords = getVisibleLeaveRecords();

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(5); // Default to May
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'TABLE' | 'MOBILE_LIST'>('CALENDAR');

  // Mobile list specific filters
  const [mobileEmpFilter, setMobileEmpFilter] = useState<string>('');
  const [mobileShowOnlyLeaves, setMobileShowOnlyLeaves] = useState<boolean>(true);

  // Auto-switch to Mobile List mode on small screens on initial mount
  useEffect(() => {
    if (window.innerWidth < 768) {
      setViewMode('MOBILE_LIST');
    }
  }, []);

  // Quick Action Switchers
  const [quickLeaveMode, setQuickLeaveMode] = useState<boolean>(false);
  const [quickLeaveType, setQuickLeaveType] = useState<LeaveType>('排休');
  const [quickTargetEmpId, setQuickTargetEmpId] = useState<string>(() => {
    const defaultEmp = INITIAL_EMPLOYEES.find(e => e.role === 'ADMIN');
    return defaultEmp ? defaultEmp.id : '';
  });

  // Modal Control States
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isEmpManagerOpen, setIsEmpManagerOpen] = useState(false);

  // Leave Editor Dialog States
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editRecords, setEditRecords] = useState<{ [empId: string]: { active: boolean; type: LeaveType; note: string } }>({});

  // Auth Dialog state
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const [authSelectId, setAuthSelectId] = useState<string>(() => {
    // Return the first employee's ID to populate dropdown selection
    const saved = localStorage.getItem('team_scheduling_employees');
    const emps = saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    return emps[0]?.id || '';
  });
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Export PDF indicator
  const [isExporting, setIsExporting] = useState(false);

  // Status Alerts
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const showToast = (text: string, isError: boolean = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // -------------------------------------------------------------
  // 3. Operation Logs Helper
  // -------------------------------------------------------------
  const handleAddLog = (action: string, details: string) => {
    const newLog: SecurityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      operator: currentLoginUser ? currentLoginUser.name : '訪客/系統',
      action,
      details,
    };
    setSecurityLogs((prev) => [newLog, ...prev]);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  // 2. 獨立單點上傳：當員工點選假單時，立刻同步該變更
  const syncChangeToGoogleSheets = async (updatedLeaves: LeaveRecord[], targetEmployeeName: string) => {
    if (!apiUrl) return;
    try {
      localStorage.setItem('team_scheduling_leaves', JSON.stringify(updatedLeaves));
      
      await fetch(apiUrl, {
        method: 'POST',
        mode: 'no-cors', // 確保跨網域不會被攔截
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetEmployeeName,
          // 把整包最新的 LEAVE_RECORDS 與名單打包傳送，由 GAS 進行行級鎖定更新
          all_data: {
            EMPLOYEES: employees,
            LEAVE_RECORDS: updatedLeaves,
            SECURITY_LOGS: securityLogs
          }
        })
      });
      console.log(`${targetEmployeeName} 的排班已即時獨立同步至 Google Sheets`);
      const syncTime = new Date().toLocaleString();
      setLastSynced(syncTime);
      localStorage.setItem('team_scheduling_last_synced', syncTime);
    } catch (error) {
      console.error("即時同步至 Google Sheets 失敗:", error);
    }
  };

  const handleCloudUpload = async () => {
    if (!apiUrl) {
      showToast('未設定 VITE_API_URL 雲端同步連結，請聯絡系統管理員設定！', true);
      return;
    }

    setIsUploading(true);
    showToast('正在將本地資料備份並上傳至 Google Sheets 中...');
    handleAddLog('雲端備份上傳', '將本地端同仁與排休排班資料備份上傳至 Google Sheets。');

    try {
      await fetch(apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ALL_DATA_BACKUP',
          all_data: {
            EMPLOYEES: employees,
            LEAVE_RECORDS: leaveRecords,
            SECURITY_LOGS: securityLogs,
          }
        })
      });

      const syncTime = new Date().toLocaleString();
      setLastSynced(syncTime);
      localStorage.setItem('team_scheduling_last_synced', syncTime);
      setStatus('Google 試算表雙軌同步已連線 (CONNECTED)');

      handleAddLog('雲端備份成功', '成功將本地最新同仁及排休資料覆蓋備份至試算表。');
      showToast('資料已成功備份上傳至 Google Sheets 試算表！');
    } catch (err: any) {
      handleAddLog('雲端備份上傳失敗', `備份上傳錯誤：${err.message || err}`);
      showToast(`備份上傳失敗：${err.message || '連線中斷'}`, true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloudDownload = async () => {
    if (!apiUrl) {
      showToast('未設定 VITE_API_URL 雲端同步連結，請聯絡系統管理員設定！', true);
      return;
    }

    setIsDownloading(true);
    showToast('正在自 Google Sheets 下載最新備份資料...');
    handleAddLog('雲端下載資料', '啟動從 Google Sheets 下載雲端備份回復程序。');

    try {
      const pullRes = await fetch(apiUrl);
      if (!pullRes.ok) {
        throw new Error(`雲端讀取失敗 (狀態碼: ${pullRes.status})`);
      }

      const cloudData = await pullRes.json();
      if (!cloudData) {
        throw new Error('雲端找不到備份資料！');
      }

      if (cloudData.EMPLOYEES && Array.isArray(cloudData.EMPLOYEES)) {
        setEmployees(cloudData.EMPLOYEES);
      }
      
      if (cloudData.LEAVE_RECORDS) {
        if (Array.isArray(cloudData.LEAVE_RECORDS)) {
          setLeaveRecords(cloudData.LEAVE_RECORDS);
        } else if (typeof cloudData.LEAVE_RECORDS === 'object') {
          const flatLeaves: LeaveRecord[] = [];
          Object.entries(cloudData.LEAVE_RECORDS).forEach(([empName, records]) => {
            const emp = employees.find(e => e.name === empName);
            if (Array.isArray(records)) {
              records.forEach((rec: any, idx: number) => {
                flatLeaves.push({
                   id: rec.id || `lr-${empName}-${rec.date}-${idx}`,
                   employeeId: emp?.id || empName,
                   employeeName: empName,
                   role: emp?.role || 'CLEANER',
                   date: rec.date,
                   type: rec.type || '排休',
                   note: rec.note || '',
                });
              });
            }
          });
          setLeaveRecords(flatLeaves);
        }
      }

      if (cloudData.SECURITY_LOGS && Array.isArray(cloudData.SECURITY_LOGS)) {
        setSecurityLogs(cloudData.SECURITY_LOGS);
      }

      const syncTime = new Date().toLocaleString();
      setLastSynced(syncTime);
      localStorage.setItem('team_scheduling_last_synced', syncTime);
      setStatus('Google 試算表雙軌同步已連線 (CONNECTED)');

      handleAddLog('雲端還原成功', '成功從雲端回復資料至本地端，完全覆蓋舊資料。');
      showToast('雲端備份資料已成功下載並還原至本地端！');
    } catch (err: any) {
      handleAddLog('雲端回復失敗', `雲端資料下載失敗：${err.message || err}`);
      showToast(`下載還原失敗：${err.message || '連線中斷'}`, true);
    } finally {
      setIsDownloading(false);
      setIsRestoreConfirmOpen(false);
    }
  };

  // -------------------------------------------------------------
  // 4. Calendar Matrix Generator math helpers
  // -------------------------------------------------------------
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayIndex = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0: Sun, 1: Mon...

  const calendarDays: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

  // Previous month trailing days
  const prevMonthYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const prevMonthDays = new Date(prevMonthYear, prevMonth, 0).getDate();

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const mStr = prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`;
    const dStr = d < 10 ? `0${d}` : `${d}`;
    calendarDays.push({
      dateStr: `${prevMonthYear}-${mStr}-${dStr}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Current month active days
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const dStr = d < 10 ? `0${d}` : `${d}`;
    calendarDays.push({
      dateStr: `${selectedYear}-${mStr}-${dStr}`,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Next month leading days to complete grid (usually 42 blocks)
  const remainingSlots = 42 - calendarDays.length;
  const nextMonthYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  for (let d = 1; d <= remainingSlots; d++) {
    const mStr = nextMonth < 10 ? `0${nextMonth}` : `${nextMonth}`;
    const dStr = d < 10 ? `0${d}` : `${d}`;
    calendarDays.push({
      dateStr: `${nextMonthYear}-${mStr}-${dStr}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  const navigateMonth = (direction: 'PREV' | 'NEXT') => {
    if (direction === 'PREV') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
    handleAddLog('切換行事曆', `快速回到今日：${today.getFullYear()}年${today.getMonth() + 1}月。`);
    showToast(`已切換至今日月份：${today.getFullYear()}年${today.getMonth() + 1}月`);
  };

  // -------------------------------------------------------------
  // 5. Leave validation & processing rules (e.g. CLEANER daily limit is 1)
  // -------------------------------------------------------------
  const checkCleanerLimit = (date: string, empId: string): { allowed: boolean; activeCleanerName?: string } => {
    // 1. Find employee role
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return { allowed: true };

    if (emp.role !== 'CLEANER') {
      // Non-cleaners have no limitations
      return { allowed: true };
    }

    // "管理人員排班不在此限" - If currently logged in user is admin or manager, bypass other cleaner check!
    if (currentLoginUser?.role === 'ADMIN' || currentLoginUser?.role === 'MANAGER') {
      return { allowed: true };
    }

    // 2. Find any active CLEANER records for this date excluding target employee
    const otherCleanersOnLeave = leaveRecords.filter(
      (lr) =>
        lr.date === date &&
        lr.employeeId !== empId &&
        lr.role === 'CLEANER'
    );

    if (otherCleanersOnLeave.length >= 1) {
      return {
        allowed: false,
        activeCleanerName: otherCleanersOnLeave[0].employeeName,
      };
    }

    return { allowed: true };
  };

  // -------------------------------------------------------------
  // 6. Action Handlers: Auth control gates
  // -------------------------------------------------------------
  const handleOpenAuthPanel = () => {
    const firstEmp = employees[0];
    setAuthSelectId(firstEmp ? firstEmp.id : '');
    setAuthPasswordInput('');
    setAuthError('');
    setIsAuthPanelOpen(true);
  };

  const handlePerformLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === authSelectId);
    if (!emp) return;

    if (emp.password === authPasswordInput) {
      setCurrentLoginUser(emp);
      setIsAuthPanelOpen(false);
      handleAddLog('帳身安全登入', `人員「${emp.name}」登入系統成功，取得其作業權限。`);
      showToast(`登入成功！當前操作者：${emp.name} (${ROLE_LABELS[emp.role]})`);

      // Sync default quick target employee to the newly logged in user
      setQuickTargetEmpId(emp.id);
    } else {
      setAuthError('密碼錯誤！請輸入該人員之正確 4 位數密碼代口令。');
      handleAddLog('登入失敗嘗試', `試圖登入「${emp.name}」但密碼口令驗證失敗。`);
    }
  };

  const handleLogout = () => {
    if (currentLoginUser) {
      handleAddLog('帳身安全登出', `人員「${currentLoginUser.name}」登出系統。`);
      showToast(`已登出人員身分，返回訪客唯讀。`);
    }
    setCurrentLoginUser(null);
  };

  // -------------------------------------------------------------
  // 7. Action Handlers: Date Cell Clicking
  // -------------------------------------------------------------
  const handleDateClick = (dateStr: string) => {
    if (!currentLoginUser) {
      handleOpenAuthPanel();
      return;
    }

    const isAuthorized =
      currentLoginUser.role === 'ADMIN' || currentLoginUser.role === 'MANAGER';

    const isQuickModeActive = currentLoginUser.role !== 'ADMIN' || quickLeaveMode;

    // A. QUICK LEAVE MODE (DIRECT CLICK TOGGLE)
    if (isQuickModeActive) {
      // In quick mode, determine target employee
      const targetEmpId = isAuthorized ? quickTargetEmpId : currentLoginUser.id;
      const targetEmp = employees.find((e) => e.id === targetEmpId);
      if (!targetEmp) return;

      // Check if already on leave
      const existing = leaveRecords.find(
        (lr) => lr.date === dateStr && lr.employeeId === targetEmpId
      );

      if (existing) {
        // Remove leave
        const remaining = leaveRecords.filter((lr) => lr.id !== existing.id);
        setLeaveRecords(remaining);
        handleAddLog(
          '取消休假(快捷)',
          `移除「${targetEmp.name}」於 ${dateStr} 的排休。`
        );
        showToast(`已為 ${targetEmp.name} 取消 ${dateStr} 的休假`);
        syncChangeToGoogleSheets(remaining, targetEmp.name);
      } else {
        // Add leave -> Validation limit!
        const check = checkCleanerLimit(dateStr, targetEmpId);
        if (!check.allowed) {
          showToast(
            `排班限制：外勤人員每日上限 1 人！${dateStr} 已有「${check.activeCleanerName}」休假`,
            true
          );
          return;
        }

        const newRecord: LeaveRecord = {
          id: `lr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          employeeId: targetEmpId,
          employeeName: targetEmp.name,
          role: targetEmp.role,
          date: dateStr,
          type: quickLeaveType,
          note: '快捷鍵建立',
        };

        const updated = [...leaveRecords, newRecord];
        setLeaveRecords(updated);
        handleAddLog(
          '設定休假(快捷)',
          `為「${targetEmp.name}」排定 ${dateStr} 為【${quickLeaveType}】。`
        );
        showToast(`已為 ${targetEmp.name} 登記 ${dateStr}【${quickLeaveType}】`);
        syncChangeToGoogleSheets(updated, targetEmp.name);
      }
      return;
    }

    // B. STANDARD POPUP EDIT ON CLICK
    setEditingDate(dateStr);

    // Prepare default temporary record map for this date
    const map: typeof editRecords = {};
    employees.forEach((emp) => {
      const match = leaveRecords.find(
        (lr) => lr.date === dateStr && lr.employeeId === emp.id
      );
      map[emp.id] = {
        active: !!match,
        type: match ? match.type : '排休',
        note: match ? match.note : '',
      };
    });
    setEditRecords(map);
  };

  // Submit standard date leaves editing dialog
  const handleSaveDateLeaves = () => {
    if (!editingDate) return;

    const updatedLeavesList = [...leaveRecords];
    const isHeaderAuthorized =
      currentLoginUser?.role === 'ADMIN' || currentLoginUser?.role === 'MANAGER';

    // Audit logs details builders
    const addedLogs: string[] = [];
    const removedLogs: string[] = [];

    // Let's iterate through each employee's temporary record in the form
    for (const empId of Object.keys(editRecords)) {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) continue;

      // Authorization Gate block: regular staff can only modify themes/leave for THEMSELVES
      if (!isHeaderAuthorized && empId !== currentLoginUser?.id) {
        // Skip modifying other employees
        continue;
      }

      const tempState = editRecords[empId];
      const existingIdx = updatedLeavesList.findIndex(
        (lr) => lr.date === editingDate && lr.employeeId === empId
      );

      if (tempState.active) {
        // If they want to add/update
        if (existingIdx >= 0) {
          // Just update info
          const orig = updatedLeavesList[existingIdx];
          if (orig.type !== tempState.type || orig.note !== tempState.note) {
            updatedLeavesList[existingIdx] = {
              ...orig,
              type: tempState.type,
              note: tempState.note,
            };
            addedLogs.push(`${emp.name}(更換為${tempState.type})`);
          }
        } else {
          // Add brand new entry -> Check cleaner limits first!
          const limitCheck = checkCleanerLimit(editingDate, empId);
          if (!limitCheck.allowed) {
            alert(
              `⚠️ 超限警告！\n當月份 ${editingDate} 已有另一位外勤人員「${limitCheck.activeCleanerName}」在休假中。\n外勤組每天最多限 1 人排休，系統已拒絕「${emp.name}」的此筆假單。`
            );
            return; // stop execution completely to allow user to retry
          }

          updatedLeavesList.push({
            id: `lr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            employeeId: empId,
            employeeName: emp.name,
            role: emp.role,
            date: editingDate,
            type: tempState.type,
            note: tempState.note,
          });
          addedLogs.push(`${emp.name}(新增${tempState.type})`);
        }
      } else {
        // If they want to cancel leave
        if (existingIdx >= 0) {
          updatedLeavesList.splice(existingIdx, 1);
          removedLogs.push(emp.name);
        }
      }
    }

    setLeaveRecords(updatedLeavesList);
    syncChangeToGoogleSheets(updatedLeavesList, currentLoginUser?.name || '管理員設定');

    // Build operational audit log description
    let logsText = '';
    if (addedLogs.length > 0) {
      logsText += `建立排休：${addedLogs.join('、')}。`;
    }
    if (removedLogs.length > 0) {
      logsText += `取消排休：${removedLogs.join('、')}。`;
    }

    if (logsText) {
      handleAddLog('更新單日排休', `修改 ${editingDate} 的排休資訊。${logsText}`);
      showToast(`已成功保存其休假調度安排`);
    }

    setEditingDate(null);
  };

  // Clean all leaves for a single date
  const handleClearAllDateLeaves = (dateStr: string) => {
    if (!window.confirm(`確定要清除 ${dateStr} 所有登記的團隊假單嗎？`)) return;
    const remaining = leaveRecords.filter((lr) => lr.date !== dateStr);
    setLeaveRecords(remaining);
    syncChangeToGoogleSheets(remaining, '全體清除-' + dateStr);
    handleAddLog('清空單日排休', `已完整清除 ${dateStr} 上登錄的所有假單紀錄。`);
    showToast(`已清空 ${dateStr} 的排班`);
    setEditingDate(null);
  };

  // -------------------------------------------------------------
  // 8. PDF Export & Printing high fidelity
  // -------------------------------------------------------------
  const handleExportPDF = async () => {
    const sourceNode = document.getElementById('printable-schedule-sheet');
    if (!sourceNode) return;

    setIsExporting(true);
    handleAddLog('呼叫 A4 報表導出', `嘗試產生 ${selectedYear} 年 ${selectedMonth} 月 A4 PDF 列印單。`);
    showToast('正在優雅生成高解析度月度排班表及下載 PDF，請稍候...');

    try {
      const originalStyle = sourceNode.style.maxHeight;
      sourceNode.style.maxHeight = 'none'; // Uncap height during rendering

      const canvas = await html2canvas(sourceNode, {
        scale: 2, // High resolution crispiness
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Gather CSS rules from the active document (which are already loaded safely by browser)
          let combinedCSS = '';
          try {
            const originalSheets = document.styleSheets;
            for (let i = 0; i < originalSheets.length; i++) {
              const sheet = originalSheets[i];
              try {
                const rules = sheet.cssRules || sheet.rules;
                if (rules) {
                  for (let j = 0; j < rules.length; j++) {
                    combinedCSS += rules[j].cssText + '\n';
                  }
                }
              } catch (e) {
                // Ignore cross-origin stylesheet errors (e.g., Google Fonts block)
              }
            }
          } catch (e) {
            console.error('Error gathering stylesheets during clone operation:', e);
          }

          // Sanitize CSS to replace oklch(...) colors with a safe standard color (e.g., #4f46e5 / indigo)
          const sanitizedCSS = combinedCSS.replace(/oklch\([^\)]+\)/g, '#4f46e5');

          // Remove all original styling blocks, excluding global Google Fonts links to preserve design
          const originalStyles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          originalStyles.forEach((el) => {
            const href = el.getAttribute('href');
            if (!href || !href.includes('fonts.googleapis.com')) {
              el.remove();
            }
          });

          // Inject the single, processed and sanitized css text block
          const newStyleTag = clonedDoc.createElement('style');
          newStyleTag.textContent = sanitizedCSS;
          clonedDoc.head.appendChild(newStyleTag);

          // Additionally, traverse and clean any inline styles containing oklch values
          const elementsWithInlineStyle = clonedDoc.querySelectorAll('[style]');
          elementsWithInlineStyle.forEach((el: any) => {
            const styleAttr = el.getAttribute('style');
            if (styleAttr && styleAttr.includes('oklch')) {
              el.setAttribute('style', styleAttr.replace(/oklch\([^\)]+\)/g, '#4f46e5'));
            }
          });
        },
      });

      sourceNode.style.maxHeight = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 standard width (mm)
      const pageHeight = 297; // A4 standard height (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight > pageHeight ? pageHeight : imgHeight);
      
      // Let's print pages if content overflowed
      let heightLeft = imgHeight - pageHeight;
      let position = -pageHeight;
      while (heightLeft > 0) {
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;
      }

      pdf.save(`團隊排班表_${selectedYear}年${selectedMonth}月.pdf`);
      handleAddLog('匯出 PDF 成功', `成功下載PDF：團隊排班表_${selectedYear}年${selectedMonth}月.pdf。`);
      showToast('PDF 排班表已成功生成並下載！');
    } catch (err: any) {
      console.error(err);
      handleAddLog('匯出 PDF 失敗', `系統錯誤：${err.message || err}`);
      showToast('PDF 下載失敗，請試試 Ctrl+P 手動列印。', true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // 9. Statistics and calculations for Selected Month
  // -------------------------------------------------------------
  const getLeavesCountByEmp = (empId: string) => {
    return leaveRecords.filter(
      (lr) =>
        lr.employeeId === empId &&
        lr.date.startsWith(`${selectedYear}-${selectedMonth < 10 ? '0' + selectedMonth : selectedMonth}`)
    ).length;
  };

  const getRoleLeaveCountOnDate = (date: string, role: Role) => {
    return leaveRecords.filter((lr) => lr.date === date && lr.role === role).length;
  };

  // Determine current credentials authorization level text
  const getAuthLevelLabel = () => {
    if (!currentLoginUser) return '訪客/唯讀模式';
    return `${currentLoginUser.name} (${ROLE_LABELS[currentLoginUser.role as Role]})`;
  };

  if (!currentLoginUser) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-center font-sans p-4 antialiased">
        <div className="w-full max-w-sm bg-white shadow-2xl rounded-2xl border border-slate-200/60 overflow-hidden flex flex-col relative">
          
          <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 pointer-events-none">
            v2.6.0
          </div>

          {/* Logo & Heading */}
          <div className="p-6 text-center border-b border-slate-100 bg-slate-50/50 flex flex-col items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-xs">
              <CalendarIcon className="w-8 h-8 mx-auto text-indigo-600" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800 font-sans">
                團隊排休管理系統
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-semibold">
                請選擇作業人員身分並輸入 4 位密碼解鎖
              </p>
            </div>
          </div>

          {/* Login Form content */}
          <form onSubmit={handlePerformLogin} className="p-6 space-y-5">
            {authError && (
              <p className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs leading-relaxed flex items-center gap-1.5 font-bold animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{authError}</span>
              </p>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 tracking-wider">
                1. 選擇作業同仁
              </label>
              <select
                value={authSelectId}
                onChange={(e) => {
                  setAuthSelectId(e.target.value);
                  setAuthError('');
                }}
                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({ROLE_LABELS[emp.role]})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <label className="tracking-wider">2. 輸入驗證密碼</label>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 rounded px-1.5 py-0.5">預設密碼 1234</span>
              </div>
              <input
                type="password"
                placeholder="請輸入密碼"
                maxLength={4}
                value={authPasswordInput}
                onChange={(e) => {
                  setAuthPasswordInput(e.target.value);
                  setAuthError('');
                }}
                className="w-full px-3 py-2.5 text-center text-sm font-mono tracking-widest border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 bg-white"
                autoFocus
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!authSelectId}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>身分確認登入</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium font-sans">
              <span>
                系統預設模式
              </span>
              <span className="bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">
                密碼口令防護區
              </span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative pb-12 antialiased">
      {/* -------------------------------------------------------------
          TOP FIXED NAVIGATION HEADER (BENTO RAIL)
          ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Connection Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold font-display tracking-tight text-slate-800">
                  團隊排休系統
                </h1>
                
                {/* Cloud Connection Badge */}
                {currentLoginUser?.role === 'ADMIN' ? (
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                      apiUrl
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}
                    title="Google Sheets 試算表連線設定狀態"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        apiUrl
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-rose-500 animate-ping'
                      }`}
                    />
                    {apiUrl ? (
                      <span>Sheets 試算表雙軌連線</span>
                    ) : (
                      <span>未設定 VITE_API_URL 變數</span>
                    )}
                  </div>
                ) : (
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      apiUrl
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        apiUrl
                          ? 'bg-emerald-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    {apiUrl ? (
                      <span>雲端同步模式</span>
                    ) : (
                      <span>離線暫存模式</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {apiUrl && lastSynced
                  ? `試算表自動備份: ${lastSynced}`
                  : '數據儲存於 LocalStorage 暫存器中'}
              </p>
            </div>
          </div>

          {/* Quick Control Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {(currentLoginUser?.role === 'ADMIN' || currentLoginUser?.role === 'MANAGER') && (
              <button
                onClick={() => setIsEmpManagerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>同仁調度</span>
              </button>
            )}

            <button
              onClick={() => setIsLogsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <List className="w-3.5 h-3.5 text-slate-500" />
              <span>操作日誌</span>
            </button>

            {/* 備份上傳按鈕 */}
            <button
              onClick={() => {
                if (!apiUrl) {
                  showToast('請先設定系統 VITE_API_URL 試算表同步網址！', true);
                  return;
                }
                handleCloudUpload();
              }}
              disabled={isUploading || isDownloading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer ${
                apiUrl
                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                  : 'text-slate-400 bg-slate-100 hover:bg-slate-200 border border-slate-200'
              }`}
              title={apiUrl ? '將本地最新資料備份並上傳至 Google Sheets（不會覆蓋本地）' : '未設定試算表 API，點按獲取詳情'}
            >
              <Upload className={`w-3.5 h-3.5 ${apiUrl ? 'text-emerald-600' : 'text-slate-400'} ${isUploading ? 'animate-bounce' : ''}`} />
              <span>{isUploading ? '正在上傳...' : '備份上傳'}</span>
            </button>

            {/* 下載還原按鈕 */}
            <button
              onClick={() => {
                if (!apiUrl) {
                  showToast('請先設定系統 VITE_API_URL 試算表同步網址！', true);
                  return;
                }
                setIsRestoreConfirmOpen(true);
              }}
              disabled={isUploading || isDownloading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer ${
                apiUrl
                  ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
                  : 'text-slate-400 bg-slate-100 hover:bg-slate-200 border border-slate-200'
              }`}
              title={apiUrl ? '從 Google Sheets 下載最新備份回復至本地端（會完全覆蓋本地）' : '未設定試算表 API，點按獲取詳情'}
            >
              <Download className={`w-3.5 h-3.5 ${apiUrl ? 'text-indigo-600' : 'text-slate-400'} ${isDownloading ? 'animate-pulse' : ''}`} />
              <span>{isDownloading ? '正在下載...' : '下載還原'}</span>
            </button>



            {/* Custom User Logged In UI widget */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 pl-2.5">
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-400">目前使用者</span>
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  {currentLoginUser ? (
                    <>
                      <span
                        style={{ backgroundColor: currentLoginUser.color }}
                        className="w-2 h-2 rounded-full inline-block"
                      />
                      {currentLoginUser.name}
                    </>
                  ) : (
                    '唯讀訪客'
                  )}
                </span>
              </div>
              
              {currentLoginUser ? (
                <button
                  onClick={handleLogout}
                  className="p-1 px-2.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="登出作業人員身分"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleOpenAuthPanel}
                  className="p-1 px-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>登入解鎖</span>
                </button>
              )}
            </div>
          </div>

          {/* Real-time sync diagnostic panel for admins */}
          {currentLoginUser?.role === 'ADMIN' && (
            <div className="w-full mt-2.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500 animate-fade-in shadow-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">🔍 Google Sheets 試算表連線狀態</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    apiUrl ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {apiUrl ? '已連線 (CONNECTED)' : '未設定 (UNCONFIGURED)'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] pt-0.5">
                <span>
                  <strong className="text-slate-600">API 連結:</strong>{' '}
                  {apiUrl ? (
                    <span className="text-emerald-600 font-bold font-mono">
                      {apiUrl.substring(0, Math.min(apiUrl.length, 30))}...
                    </span>
                  ) : (
                    <span className="text-rose-500 font-semibold">尚未設定 VITE_API_URL 環境變數</span>
                  )}
                </span>
                {apiUrl && (
                  <>
                    <span className="text-slate-200">|</span>
                    <span>
                      <strong className="text-slate-600">最新同步模式:</strong>{' '}
                      <span className="text-indigo-600 font-bold">雙軌即時雙向備份</span>
                    </span>
                  </>
                )}
                {lastSynced && (
                  <>
                    <span className="text-slate-200">|</span>
                    <span>
                      <strong className="text-slate-600">上次連線同步時間:</strong>{' '}
                      <span className="font-bold text-emerald-600 font-mono">{lastSynced}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* -------------------------------------------------------------
          TOAST ALERT BANNER (TOP CENTRAL)
          ------------------------------------------------------------- */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-slow">
          <div
            className={`shadow-xl rounded-full px-5 py-2.5 text-xs font-semibold border inline-flex items-center gap-2 ${
              toastMessage.isError
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {toastMessage.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MAIN APPLICATION WORKSPACE (BENTO GRID STYLE)
          ------------------------------------------------------------- */}
      <main className="max-w-7xl w-full mx-auto p-4 flex-1 space-y-6">
        
        {/* Bento Board: Controls & Fast Switchers Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 no-print">
          
          {/* Bento Block 1: Date selections & View Navigator */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                月曆時間調度
              </span>
              <button
                onClick={jumpToToday}
                className="text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-md px-2 py-1 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                回到今日 (Today)
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 my-1">
              <button
                onClick={() => navigateMonth('PREV')}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="上一個月"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Year Select */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border-0 text-slate-800 font-bold text-lg font-display focus:ring-0 cursor-pointer"
                >
                  <option value={2025}>2025 年</option>
                  <option value={2026}>2026 年</option>
                  <option value={2027}>2027 年</option>
                  <option value={2028}>2028 年</option>
                </select>

                <span className="text-slate-300">/</span>

                {/* Month Select */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-white border-0 text-indigo-700 font-bold text-lg font-display focus:ring-0 cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m} 月
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => navigateMonth('NEXT')}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="下一個月"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Switching tabs */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-1 flex">
              <button
                onClick={() => setViewMode('CALENDAR')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'CALENDAR'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">日曆檢視</span>
                <span className="xs:hidden">日曆</span>
              </button>

              <button
                onClick={() => setViewMode('TABLE')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">表格對帳</span>
                <span className="xs:hidden">對帳</span>
              </button>

              <button
                onClick={() => setViewMode('MOBILE_LIST')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'MOBILE_LIST'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <List className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="hidden xs:inline text-indigo-700">手機清單</span>
                <span className="xs:hidden text-indigo-700">手機</span>
              </button>
            </div>
          </div>

          {/* Bento Block 2: Quick Leave Mode (快捷排休面板) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                ⚡ 快速排休輔助發射器
              </span>
              
              {/* Toggle switcher */}
              <button
                onClick={() => {
                  setQuickLeaveMode(!quickLeaveMode);
                  handleAddLog('開關快捷排班模式', `使用者將快捷排休模態切換為：${!quickLeaveMode ? '開啟' : '關閉'}`);
                }}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full cursor-pointer transition-all ${
                  quickLeaveMode
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {quickLeaveMode ? (
                  <>
                    <ToggleRight className="w-5 h-5 text-amber-600" />
                    <span>快捷模式已開啟</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-5 h-5 text-slate-400" />
                    <span>點擊日期彈窗</span>
                  </>
                )}
              </button>
            </div>

            {quickLeaveMode ? (
              <div className="my-1 p-3 bg-amber-50/55 rounded-xl border border-amber-100 text-xs text-slate-600 space-y-2.5 animate-fade-in">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-amber-900">1. 排定對象：</span>
                    {/* If Admin/Manager, they can select who to quick schedule */}
                    {currentLoginUser && (currentLoginUser.role === 'ADMIN' || currentLoginUser.role === 'MANAGER') ? (
                      <select
                        value={quickTargetEmpId}
                        onChange={(e) => setQuickTargetEmpId(e.target.value)}
                        className="py-0.5 px-2 text-xs bg-white border border-amber-200 rounded text-slate-700 font-bold focus:outline-none"
                      >
                        {visibleEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({ROLE_LABELS[emp.role as Role]})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-200">
                        {currentLoginUser?.name || '請登入'}（限本人）
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 font-semibold text-amber-900 border border-slate-200/40 rounded px-2.5 py-0.5 bg-white text-xs">
                    <span>2. 指定狀態：</span>
                    <span className="text-indigo-700 font-extrabold font-sans">排休</span>
                  </div>
                </div>

                <p className="text-[11px] text-amber-800 leading-relaxed font-sans font-medium flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0 inline text-amber-600" />
                  <span>
                    配置完成！現在<strong>點按下方日曆格子或表格</strong>可立即增設或取消「排休」 (外勤人員每天限一人)。
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed my-2 font-sans py-2">
                預設「彈窗模式」：滑鼠點擊任何日期，即會展開單日設定表，供您靈活管理多位員工的排休以及備忘說明（不設複雜假別）。
                <br />
                <span className="text-[10px] text-indigo-500 font-semibold">
                  💡 貼心提示：當要大量排休假期時，點擊右上方開啟「快捷排休模式」更具排班效率。
                </span>
              </p>
            )}

            {/* Legends of Leave Types */}
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold text-slate-400">目前假別：</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                排休 (Rest Day / Day Off)
              </span>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            PRINTABLE SHEETCONTAINER (DENSELY STYLED A4 FORMAT)
            ------------------------------------------------------------- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md transition-shadow relative">
          
          {/* Printable controller bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4 no-print">
            <div>
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1">
                <FileText className="w-4 h-4 text-slate-500" />
                排課休假報表匯出面版
              </h2>
              <p className="text-xs text-slate-400">
                本區月曆表格完美支援 html2canvas 的 A4 直式快照渲染，點擊按鈕即可立即存檔。
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleBrowserPrint}
                className="inline-flex items-center gap-1.5 px-4.5 py-2 hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                瀏覽器列印 (Print)
              </button>

              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                {isExporting ? '正產生高解析 A4...' : '導出 A4 PDF 表格'}
              </button>
            </div>
          </div>

          {/* This is the printable target container */}
          <div
            id="printable-schedule-sheet"
            className={`p-4 sm:p-6 bg-white overflow-x-auto rounded-2xl print-card ${
              viewMode === 'MOBILE_LIST' ? 'w-full' : 'min-w-[700px]'
            }`}
          >
            {/* Inside sheet header (shows on PDF/Print) */}
            <div className="text-center space-y-2 mb-6">
              <div className="inline-flex items-center gap-2">
                <span className="text-xs tracking-widest font-mono text-indigo-600 uppercase font-bold bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-sm">
                  Team Scheduling System
                </span>
                <span className="text-xs tracking-widest font-mono text-slate-500 uppercase font-bold bg-slate-150 border px-3 py-1 rounded-sm">
                  A4 Report Sheet
                </span>
              </div>
              <h2 className="text-2xl font-extrabold font-display tracking-tight text-slate-900">
                團隊值班與排休落點月報表
              </h2>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                中華民國 115 年（西元 2026年）{selectedMonth} 月度排休配置，本表由「團隊排休系統」於系統時間 {new Date().toLocaleDateString('zh-TW')} 自動核發。
              </p>
              
              {/* Daily CLEANER limit notice on report */}
              <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400">
                <span>● 稽核守則：外勤組 (CLEANER) 每日上限排休 1 人</span>
                <span>● 單位/組別：外勤、櫃台、工讀、行政主管</span>
              </div>
            </div>

            {/* View Switching Rendering */}
            {viewMode === 'CALENDAR' && (
              // -------------------------------------------------------------
              // STANDARD CALENDAR VIEW WITH HIGH DENSITY INTERFACE
              // -------------------------------------------------------------
              <div className="font-sans">
                {/* Weekly names header */}
                <div className="grid grid-cols-7 border-t border-x border-slate-200 bg-slate-50/80 rounded-t-xl text-center">
                  {['週日 (Sun)', '週一 (Mon)', '週二 (Tue)', '週三 (Wed)', '週四 (Thu)', '週五 (Fri)', '週六 (Sat)'].map((weekday, index) => (
                    <div
                      key={index}
                      className={`py-2.5 text-xs font-bold border-r border-slate-200 last:border-r-0 ${
                        index === 0 ? 'text-red-600 bg-red-50/30' : index === 6 ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-600'
                      }`}
                    >
                      {weekday}
                    </div>
                  ))}
                </div>

                {/* Calendar Days grids */}
                <div className="grid grid-cols-7 border-l border-t border-slate-200">
                  {calendarDays.map((day, idx) => {
                    const isToday = day.dateStr === new Date().toISOString().split('T')[0];
                    const holidayName = TAIWAN_HOLIDAYS_2026[day.dateStr];
                    
                    // Filter records for this day (filtered based on visibility permissions)
                    const recordsOnDay = visibleLeaveRecords.filter((lr) => lr.date === day.dateStr);
                    const cleanerOnDay = recordsOnDay.filter((r) => r.role === 'CLEANER');
                    const hasCleanerLimitViolation = cleanerOnDay.length > 1;

                    // Get week day index
                    const dateObj = new Date(day.dateStr);
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleDateClick(day.dateStr)}
                        className={`min-h-[105px] border-r border-b border-slate-200 p-2 cursor-pointer transition-all flex flex-col justify-between hover:bg-indigo-50/30 ${
                          day.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 opacity-55'
                        } ${isToday ? 'ring-2 ring-indigo-600 ring-inset bg-indigo-50/10' : ''}`}
                      >
                        {/* Day numbers & Taiwan holidays */}
                        <div className="flex items-start justify-between">
                          <span
                            className={`text-xs font-bold font-mono inline-flex items-center justify-center w-5.5 h-5.5 rounded-full ${
                              isToday
                                ? 'bg-indigo-600 text-white'
                                : isWeekend
                                ? dateObj.getDay() === 0
                                  ? 'text-red-500'
                                  : 'text-indigo-500'
                                : 'text-slate-500'
                            }`}
                          >
                            {day.dayNum}
                          </span>

                          {holidayName ? (
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 rounded px-1 scale-95 origin-right">
                              {holidayName}
                            </span>
                          ) : null}
                        </div>

                        {/* Leave personnel labels for this day */}
                        <div className="my-1.5 space-y-1 overflow-hidden flex-1 flex flex-col justify-end">
                          {recordsOnDay.map((lr) => {
                            const empTheme = employees.find((e) => e.id === lr.employeeId);
                            // Set custom borders based on type
                            const leafColor = LEAVE_COLORS[lr.type as LeaveType] || { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200' };
                            return (
                              <div
                                key={lr.id}
                                style={{ borderLeftColor: empTheme?.color || '#333' }}
                                className="text-[10px] pl-1.5 py-0.5 border-l-2 bg-slate-50/90 hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-between"
                                title={`假種: ${lr.type} | 備註: ${lr.note || '無'}`}
                              >
                                <span className="font-semibold text-slate-700 truncate">
                                  {lr.employeeName}
                                </span>
                                <span className={`text-[8px] font-semibold px-1 rounded transform scale-90 ${leafColor.bg} ${leafColor.text}`}>
                                  {lr.type}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Warning Limit Label if Cleaner count exceeds or hits quota */}
                        <div className="text-[9px] font-semibold text-right">
                          {cleanerOnDay.length > 0 && (
                            <span className="text-emerald-700 bg-emerald-50 px-1 border border-emerald-200 rounded">
                              外勤組休假 1/1
                            </span>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'TABLE' && (
              // -------------------------------------------------------------
              // TABLE STATEMENT (MATRIX EXCEL-LIKE SPREADSHEET VIEW)
              // -------------------------------------------------------------
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="p-3 font-semibold sticky left-0 bg-slate-50 border-r border-slate-200 min-w-[125px]">
                        同仁姓名 (員組)
                      </th>
                      {/* Array of month day numbers */}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                        const mStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
                        const dStr = d < 10 ? `0${d}` : `${d}`;
                        const dateStr = `${selectedYear}-${mStr}-${dStr}`;
                        const dateObj = new Date(dateStr);
                        const isWeekEnd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        return (
                          <th
                            key={d}
                            className={`p-1.5 text-center font-bold font-mono border-r border-slate-200 min-w-[28px] ${
                              isWeekEnd ? 'bg-indigo-50/55' : ''
                            }`}
                          >
                            <div>{d}</div>
                            <div className="text-[8px] font-serif text-slate-400 font-medium">
                              {['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()]}
                            </div>
                          </th>
                        );
                      })}
                      <th className="p-3 text-center sticky right-0 bg-slate-50 border-l border-slate-200 min-w-[65px] font-semibold">
                        當月休
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((emp) => {
                      const leaveCount = getLeavesCountByEmp(emp.id);
                      return (
                        <tr
                          key={emp.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          {/* Name sticky left */}
                          <td className="p-3 sticky left-0 bg-white font-semibold text-slate-800 border-r border-slate-200 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span
                                style={{ backgroundColor: emp.color }}
                                className="w-2 h-2 rounded-full inline-block"
                              />
                              {emp.name}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                              {ROLE_LABELS[emp.role].substring(0, 2)}
                            </span>
                          </td>

                          {/* 1 to Month count columns */}
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                            const mStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
                            const dStr = d < 10 ? `0${d}` : `${d}`;
                            const dateStr = `${selectedYear}-${mStr}-${dStr}`;

                            const record = visibleLeaveRecords.find(
                              (lr) => lr.date === dateStr && lr.employeeId === emp.id
                            );

                            return (
                              <td
                                key={d}
                                onClick={() => handleDateClick(dateStr)}
                                className={`p-0 text-center border-r border-slate-100 align-middle min-h-[35px] cursor-pointer hover:bg-indigo-50/40 relative`}
                              >
                                {record ? (
                                  <div
                                    style={{ borderLeftColor: emp.color }}
                                    className="h-full w-full py-2 flex flex-col items-center justify-center text-[10px] bg-slate-50 font-bold border-l-2 text-indigo-700"
                                    title={`假別: ${record.type} | 說明: ${record.note || '無'}`}
                                  >
                                    {record.type.substring(0, 1)}
                                  </div>
                                ) : (
                                  <div className="h-full w-full py-2 text-slate-200 text-[10px] font-sans">
                                    -
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Total rest column */}
                          <td className="p-3 sticky right-0 bg-white font-mono font-bold text-center border-l border-slate-200 text-indigo-600 bg-slate-50/20 text-xs">
                            {leaveCount} 天
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === 'MOBILE_LIST' && (
              <div className="font-sans space-y-4">
                {/* Mobile Filter Bar & Stats */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row gap-3 items-center justify-between text-xs no-print">
                  <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                    <span className="font-bold text-slate-500 shrink-0">篩選人員:</span>
                    <select
                      value={mobileEmpFilter}
                      onChange={(e) => setMobileEmpFilter(e.target.value)}
                      className="py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none flex-1 sm:flex-none text-xs"
                    >
                      <option value="">全部同仁 (Show All)</option>
                      {visibleEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({ROLE_LABELS[emp.role]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between w-full sm:w-auto gap-4 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                    <span className="font-bold text-slate-500 text-xs">顯示範圍:</span>
                    <button
                      type="button"
                      onClick={() => setMobileShowOnlyLeaves(!mobileShowOnlyLeaves)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer border ${
                        mobileShowOnlyLeaves
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mobileShowOnlyLeaves ? '僅顯示有排休日期 (精簡)' : '顯示當月所有日期 (完整)'}
                    </button>
                  </div>
                </div>

                {/* Day-by-Day Roster list */}
                <div className="space-y-3">
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
                    const mStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
                    const dStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
                    const dateStr = `${selectedYear}-${mStr}-${dStr}`;

                    const dateObj = new Date(dateStr);
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    const holidayName = TAIWAN_HOLIDAYS_2026[dateStr];
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                    
                    // Filter records on this day
                    let recordsOnDay = visibleLeaveRecords.filter((lr) => lr.date === dateStr);
                    
                    // Filter by employee if selected
                    if (mobileEmpFilter) {
                      recordsOnDay = recordsOnDay.filter((lr) => lr.employeeId === mobileEmpFilter);
                    }

                    // If "Only show days with leaves" is active, and there are no leave records, hide it
                    if (mobileShowOnlyLeaves && recordsOnDay.length === 0) {
                      return null;
                    }

                    // Count of cleaners on leave
                    const cleanersOnDay = visibleLeaveRecords.filter(lr => lr.date === dateStr && lr.role === 'CLEANER');

                    return (
                      <div
                        key={dateStr}
                        onClick={() => handleDateClick(dateStr)}
                        className={`group relative overflow-hidden bg-white border rounded-xl p-3 transition-all hover:border-slate-300 active:bg-slate-50 cursor-pointer flex flex-col sm:flex-row gap-3 items-stretch justify-between ${
                          isToday
                            ? 'ring-2 ring-indigo-600 ring-inset bg-indigo-50/10'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Day indicator section */}
                        <div className="flex items-center sm:flex-col shrink-0 gap-3 sm:gap-1 text-left sm:text-center w-full sm:w-20 pb-2 sm:pb-0 border-b sm:border-b-0 sm:border-r border-slate-100">
                          <span
                            className={`font-mono text-xl font-black rounded-lg inline-flex items-center justify-center w-9 h-9 ${
                              isToday
                                ? 'bg-indigo-600 text-white'
                                : isWeekend
                                ? dateObj.getDay() === 0
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-indigo-50 text-indigo-600'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {dayNum}
                          </span>
                          
                          <div className="flex flex-row sm:flex-col text-left sm:text-center items-center sm:items-stretch gap-2 sm:gap-0 font-sans">
                            <span className={`text-xs font-bold ${
                              isWeekend 
                                ? dateObj.getDay() === 0 
                                  ? 'text-rose-600' 
                                  : 'text-indigo-600' 
                                : 'text-slate-600'
                            }`}>
                              {['週日', '週一', '週二', '週三', '週四', '週五', '週六'][dateObj.getDay()]}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                              {selectedMonth}/{dayNum < 10 ? '0' + dayNum : dayNum}
                            </span>
                          </div>

                          {holidayName && (
                            <span className="ml-auto sm:ml-0 sm:mt-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 scale-95">
                              {holidayName}
                            </span>
                          )}
                        </div>

                        {/* Leave Cards block */}
                        <div className="flex-1 w-full space-y-2 flex flex-col justify-center">
                          {recordsOnDay.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {recordsOnDay.map((lr) => {
                                const empDetail = employees.find((e) => e.id === lr.employeeId);
                                const leafColor = LEAVE_COLORS[lr.type as LeaveType] || { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200' };
                                return (
                                  <div
                                    key={lr.id}
                                    style={{ borderLeftColor: empDetail?.color || '#cbd5e1' }}
                                    className="p-2 border-l-3 bg-slate-50/60 rounded-r-lg flex flex-col gap-1 hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <span
                                          style={{ backgroundColor: empDetail?.color }}
                                          className="w-2 h-2 rounded-full shrink-0"
                                        />
                                        {lr.employeeName}
                                        <span className="text-[9px] text-slate-400 font-medium">
                                          ({ROLE_LABELS[lr.role]})
                                        </span>
                                      </span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${leafColor.bg} ${leafColor.text} ${leafColor.border} border`}>
                                        {lr.type}
                                      </span>
                                    </div>
                                    {lr.note && (
                                      <p className="text-[10px] text-slate-500 font-medium pl-3.5 italic">
                                        備忘：{lr.note}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="h-full flex items-center py-2 text-slate-400 text-xs italic pl-2">
                              ✨ 全員出勤 (正常排班)
                            </div>
                          )}

                          {/* Cleaner limit verification banner */}
                          {cleanersOnDay.length > 0 && (
                            <div className="pt-1 flex items-center gap-1 select-none text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md w-fit px-2 py-0.5">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              <span>外勤組休假 1/1 (符合限額守則)</span>
                            </div>
                          )}
                        </div>

                        {/* Chevron right to edit indicator */}
                        <div className="self-end xs:self-center text-slate-300 group-hover:text-indigo-500 transition-colors pr-1 xs:pt-0 no-print">
                          <Edit className="w-4 h-4 cursor-pointer" />
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty filter message */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((dayNum) => {
                    const mStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
                    const dStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
                    const dateStr = `${selectedYear}-${mStr}-${dStr}`;
                    let recordsOnDay = leaveRecords.filter((lr) => lr.date === dateStr);
                    if (mobileEmpFilter) {
                      recordsOnDay = recordsOnDay.filter((lr) => lr.employeeId === mobileEmpFilter);
                    }
                    return !(mobileShowOnlyLeaves && recordsOnDay.length === 0);
                  }).length === 0 && (
                    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                      <span className="text-2xl">🏖️</span>
                      <p className="text-xs font-bold text-slate-500">
                        {mobileEmpFilter ? '該同仁此月份無任何排休登記' : '本月份此篩選條件下無任何排休紀錄'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        您可以點擊上方「顯示當月所有日期」來快速建立。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Print Footer Details */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono">
                系統總假單數：{leaveRecords.length} 筆 | 稽核身分：{getAuthLevelLabel()}
              </span>
              <span>
                由 團隊排休儲存中心 安全保護 | 西元 2026年5月 規格設計
              </span>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            SIDEBAR QUOTA AND TEAM WORKLOAD METRIC STATS
            ------------------------------------------------------------- */}
        <div className={`grid gap-5 no-print ${currentLoginUser?.role === 'ADMIN' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 max-w-xl'}`}>
          
          {/* Stats block A: CLEANER schedule checking */}
          {currentLoginUser?.role === 'ADMIN' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                外勤人員排班監控
              </h3>
              
              <p className="text-xs text-slate-500 leading-relaxed">
                根據企業政策，<strong className="text-rose-600">外勤人員 (CLEANER) 同一天最多指派 1 人排休</strong>，以維持環境現場基本工作人力：
              </p>

              <div className="space-y-1.5 text-xs">
                {visibleEmployees
                  .filter((emp) => emp.role === 'CLEANER')
                  .map((emp) => {
                    const daysNum = getLeavesCountByEmp(emp.id);
                    return (
                      <div key={emp.id} className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="flex items-center gap-1">
                          <span style={{ backgroundColor: emp.color }} className="w-2 h-2 rounded-full inline-block" />
                          {emp.name} (外勤組)
                        </span>
                        <span className="font-bold text-slate-700">{daysNum} 日排休</span>
                      </div>
                    );
                  })}
              </div>
              
              <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 text-[10px] text-slate-500 font-sans">
                * 超限檢測引擎於系統背景即時運行。在雙重視圖勾選假單，皆會直接攔截並封鎖第二名外勤同仁之申請。
              </div>
            </div>
          )}

          {/* Stats block B: Other Roles Summary list */}
          {currentLoginUser?.role === 'ADMIN' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <Sparkle className="w-3.5 h-3.5 text-indigo-500" />
                行政、櫃台與工讀生休假
              </h3>

              <p className="text-xs text-slate-500 leading-relaxed">
                櫃台前台、主管、以及計時工讀生<strong>無每日排休人限</strong>。此為本月份 ({selectedMonth}月) 同仁累計休假落點：
              </p>

              <div className="max-h-[140px] overflow-y-auto space-y-1 text-xs pr-1">
                {visibleEmployees
                  .filter((emp) => emp.role !== 'CLEANER')
                  .map((emp) => {
                    const val = getLeavesCountByEmp(emp.id);
                    return (
                      <div key={emp.id} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                        <span className="flex items-center gap-1.5">
                          <span style={{ backgroundColor: emp.color }} className="w-1.5 h-1.5 rounded-full inline-block" />
                          {emp.name}
                          <span className="text-[10px] scale-95 origin-left text-slate-400">({ROLE_LABELS[emp.role]})</span>
                        </span>
                        <span className="font-semibold text-indigo-700">{val} 日</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Stats block C: Taiwan Holidays calendar helper list */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-amber-600" />
              2026 年度國定假期對照表
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              系統內建 2026 台灣常用國定行事曆休假，以便排休日對照。
            </p>

            <div className="max-h-[130px] overflow-y-auto space-y-1 text-[11px] text-slate-600 pr-1">
              {Object.entries(TAIWAN_HOLIDAYS_2026)
                .sort((a,b) => a[0].localeCompare(b[0]))
                .map(([date, label]) => (
                  <div key={date} className="flex justify-between py-1 border-b border-slate-50 font-mono text-[10px]">
                    <span className="text-slate-500">{date}</span>
                    <span className="font-bold text-rose-600">{label}</span>
                  </div>
                ))}
            </div>
          </div>

        </div>

      </main>

      {/* -------------------------------------------------------------
          10. STANDARD DATED SCHEDULE EDITING MODAL (POPUP)
          ------------------------------------------------------------- */}
      {editingDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
            
            {/* Modal Heading */}
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  排休預排調配大師 (日期：{editingDate})
                </h3>
                <p className="text-[11px] text-slate-400">
                  {currentLoginUser && (currentLoginUser.role === 'ADMIN' || currentLoginUser.role === 'MANAGER')
                    ? '管理層模式：您可以設定全體同仁休假記錄。'
                    : `同仁專用模式：您僅能設定「${currentLoginUser?.name}」本人的假單。`}
                </p>
              </div>
              <button
                onClick={() => setEditingDate(null)}
                className="p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Modal list check fields */}
            <div className="p-5 overflow-y-auto max-h-[50vh] space-y-4">
              
              {/* Cleaner limits visual indicator */}
              <div className="p-3 bg-indigo-50 text-indigo-900 rounded-lg text-xs leading-relaxed border border-indigo-100">
                <strong className="text-indigo-950 block mb-0.5">※ 排休受限檢定提醒</strong>
                今日外勤組 ({visibleEmployees.filter((e)=>e.role==='CLEANER').map(e=>e.name).join('、')}) 同天累計不能超過 1 人。
                當前排定狀態：
                <span className="font-bold text-indigo-700 ml-1">
                  {visibleLeaveRecords.filter(lr => lr.date === editingDate && lr.role === 'CLEANER').map(lr => lr.employeeName).join(', ') || '尚無外勤同仁排休'}
                </span>
              </div>

              <div className="space-y-3">
                {visibleEmployees.map((emp) => {
                  const tempValue = editRecords[emp.id];
                  if (!tempValue) return null;

                  // Auth checks
                  const isHeaderAuthorized =
                    currentLoginUser?.role === 'ADMIN' || currentLoginUser?.role === 'MANAGER';
                  const isEditable = isHeaderAuthorized || emp.id === currentLoginUser?.id;

                  return (
                    <div
                      key={emp.id}
                      className={`p-3 border rounded-xl flex flex-col gap-2 transition-all ${
                        tempValue.active
                          ? 'border-indigo-200 bg-indigo-50/20'
                          : 'border-slate-150'
                      } ${!isEditable ? 'opacity-55' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        {/* Checkbox trigger */}
                        <label className="flex items-center gap-2 font-bold text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tempValue.active}
                            disabled={!isEditable}
                            onChange={(e) => {
                              setEditRecords((prev) => ({
                                ...prev,
                                [emp.id]: {
                                  ...prev[emp.id],
                                  active: e.target.checked,
                                },
                              }));
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 pointer-events-auto"
                          />
                          <span
                            style={{ backgroundColor: emp.color }}
                            className="w-2.5 h-2.5 rounded-full inline-block"
                          />
                          <span>
                            {emp.name} ({ROLE_LABELS[emp.role]})
                          </span>
                        </label>

                        {/* Readonly labels for others */}
                        {!isEditable && (
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-0.5">
                            <Lock className="w-3 h-3 inline" /> 唯讀鎖定
                          </span>
                        )}
                      </div>

                      {/* Detail configurations, only expanded if active */}
                      {tempValue.active && (
                        <div className="mt-1 sm:pl-6">
                          {/* Notes description input (without leave type drop-down) */}
                          <div className="w-full">
                            <input
                              type="text"
                              disabled={!isEditable}
                              placeholder="請輸入休假備忘說明（選填）"
                              value={tempValue.note}
                              onChange={(e) => {
                                setEditRecords((prev) => ({
                                  ...prev,
                                  [emp.id]: {
                                    ...prev[emp.id],
                                    note: e.target.value,
                                  },
                                }));
                              }}
                              className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-indigo-500 bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
              {currentLoginUser && (currentLoginUser.role === 'ADMIN' || currentLoginUser.role === 'MANAGER') ? (
                <button
                  onClick={() => handleClearAllDateLeaves(editingDate)}
                  className="px-3.5 py-2 hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  清空此日全部
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDate(null)}
                  className="px-4 py-2 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveDateLeaves}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  確認儲存
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          11. LOGIN & PASSWORD VALIDATION POPUP PANEL
          ------------------------------------------------------------- */}
      {isAuthPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
            
            {/* Modal Heading */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">身分確認登入</h3>
              </div>
              <button
                onClick={() => setIsAuthPanelOpen(false)}
                className="p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Login form */}
            <form onSubmit={handlePerformLogin} className="p-5 space-y-4">
              {authError && (
                <p className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs leading-relaxed flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0 inline text-rose-500" />
                  <span>{authError}</span>
                </p>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600">
                  選擇同仁身分
                </label>
                <select
                  value={authSelectId}
                  onChange={(e) => {
                    setAuthSelectId(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({ROLE_LABELS[emp.role]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600">
                  請輸入密碼 (預設均為 1234)
                </label>
                <input
                  type="password"
                  placeholder="請輸入4位數字口令代碼"
                  maxLength={4}
                  value={authPasswordInput}
                  onChange={(e) => {
                    setAuthPasswordInput(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full px-3 py-2 text-center text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 tracking-widest text-slate-800 bg-white"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthPanelOpen(false)}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  確認登入
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          13. GENERAL SECURITY OPERATIONAL LOGS MODAL
          ------------------------------------------------------------- */}
      <SecurityLogsModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        logs={securityLogs}
        isAdmin={currentLoginUser?.role === 'ADMIN'}
        onClearLogs={() => {
          setSecurityLogs([
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              operator: currentLoginUser ? currentLoginUser.name : '系統',
              action: '清除稽核軌跡',
              details: '管理員已特許清空所有歷史操作與雲端同步之安全日誌紀錄。',
            },
          ]);
        }}
      />

      {/* -------------------------------------------------------------
          14. TEAM MEMBER DIRECTORY MANAGER MODAL
          ------------------------------------------------------------- */}
      <EmployeeManager
        isOpen={isEmpManagerOpen}
        onClose={() => setIsEmpManagerOpen(false)}
        employees={employees}
        currentLoginUser={currentLoginUser}
        onAddEmployee={(newEmp) => setEmployees((prev) => [...prev, newEmp])}
        onUpdateEmployees={(newStaffList) => setEmployees(newStaffList)}
        onAddLog={handleAddLog}
      />

      {/* -------------------------------------------------------------
          15. CLOUD RESTORE CONFIRMATION MODAL
          ------------------------------------------------------------- */}
      {isRestoreConfirmOpen && (
        <div id="restore-confirm-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full p-6 animate-scale-in space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shrink-0">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">載入雲端備份警告</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  這將從雲端 Google Sheets 試算表下載最新的備份檔案（含所有同仁名單、排休紀錄與日誌），並<strong className="text-rose-600 font-bold">完全覆蓋</strong>您目前在本地端（LocalStorage）中編輯的資料。
                </p>
                <p className="text-xs font-semibold text-rose-500">
                  ※ 此操作不可逆，尚未備份之本地端變更將會遺失！
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">目前雲端設定狀態</div>
              <div className="text-xs text-slate-600 font-mono flex justify-between">
                <span>試算表狀態:</span>
                <span className="font-bold">{apiUrl ? '已配置 (CONNECTED)' : '未設定'}</span>
              </div>
              {lastSynced && (
                <div className="text-xs text-slate-600 font-mono flex justify-between">
                  <span>上次同步時間:</span>
                  <span className="font-bold text-indigo-600">{lastSynced}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1.5">
              <button
                type="button"
                onClick={() => setIsRestoreConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-150 rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleCloudDownload}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>讀取還原中...</span>
                  </>
                ) : (
                  <span>確定下載並完全覆蓋</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
