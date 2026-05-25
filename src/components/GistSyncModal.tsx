import React, { useState, useEffect } from 'react';
import { GistConfig, Employee, LeaveRecord, SecurityLog } from '../types';
import { X, Download, Upload, Github, Link, HelpCircle, Shield, AlertCircle, CheckCircle, RefreshCcw, LogOut } from 'lucide-react';

interface GistSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  leaveRecords: LeaveRecord[];
  securityLogs: SecurityLog[];
  gistConfig: GistConfig;
  onUpdateConfig: (config: GistConfig) => void;
  onRestoreState: (data: { employees: Employee[]; leaveRecords: LeaveRecord[]; securityLogs: SecurityLog[] }) => void;
  onAddLog: (action: string, details: string) => void;
}

export default function GistSyncModal({
  isOpen,
  onClose,
  employees,
  leaveRecords,
  securityLogs,
  gistConfig,
  onUpdateConfig,
  onRestoreState,
  onAddLog,
}: GistSyncModalProps) {
  const [pat, setPat] = useState('');
  const [gistId, setGistId] = useState('');
  const [testing, setTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState<'push' | 'pull' | null>(null);

  // Sync token inputs with existing config when modal opens
  useEffect(() => {
    if (gistConfig.githubToken) {
      setPat(gistConfig.githubToken);
    }
    if (gistConfig.gistId) {
      setGistId(gistConfig.gistId);
    }
  }, [gistConfig, isOpen]);

  if (!isOpen) return null;

  // 1. Export JSON local offline handler
  const handleExportLocal = () => {
    try {
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        employees,
        leaveRecords,
        securityLogs,
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const timestamp = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `團隊排休備份_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      onAddLog('匯出本機備份', '成功匯出排程、成員名冊及歷史日誌至 JSON 檔案。');
      setSuccessMsg('本機 JSON 備份檔案已成功下載！');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('匯出失敗：' + err?.message);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // 2. Import JSON local offline handler
  const handleImportLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.employees || !parsed.leaveRecords) {
          throw new Error('JSON 格式無效，必須包含員工名冊與休假紀錄。');
        }

        onRestoreState({
          employees: parsed.employees,
          leaveRecords: parsed.leaveRecords,
          securityLogs: parsed.securityLogs || [],
        });

        onAddLog(
          '本機復原還原',
          `成功上傳 JSON 備份檔，還原 ${parsed.employees.length} 位員工，以及 ${parsed.leaveRecords.length} 筆休假排程。`
        );
        setSuccessMsg('本機備份成功還原並覆蓋當前狀態！');
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err: any) {
        setErrorMsg('還原失敗：' + err?.message);
        setTimeout(() => setErrorMsg(''), 5000);
      }
    };
    fileReader.readAsText(file);
    // Reset file input value so same file can be selected again
    e.target.value = '';
  };

  // 3. Test & Save GitHub Token/Gist settings
  const handleVerifySettings = async () => {
    if (!pat.trim() || !gistId.trim()) {
      setErrorMsg('請填寫完整 GitHub PAT 與 Gist ID！');
      return;
    }

    setTesting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Fetch specific gist to test credentials and access
      const res = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pat.trim()}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }
      });

      if (res.status === 401) {
        throw new Error('認證失敗 (401)：GitHub Personal Access Token (PAT) 無效或已被撤銷。');
      } else if (res.status === 404) {
        throw new Error('找不到 Gist (404)：請確認您的 Gist ID 是否正確（需為32位十六進位字串）或該 Gist 為私有且 Token 缺乏讀取權限。');
      } else if (!res.ok) {
        throw new Error(`連線異常 (${res.status})：無法存取 GitHub API。`);
      }

      // Successful verification
      const data = await res.json();
      const updatedConfig: GistConfig = {
        githubToken: pat.trim(),
        gistId: gistId.trim(),
        lastSynced: gistConfig.lastSynced || new Date().toLocaleString(),
        status: 'CONNECTED',
      };

      onUpdateConfig(updatedConfig);
      onAddLog('驗證雲端同步埠', `GitHub Gist ${gistId.trim()} 驗證成功，切換至「雲端同步模式」。`);
      setSuccessMsg('GitHub Gist 金鑰設定驗證成功！已成功連線。');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      onUpdateConfig({
        ...gistConfig,
        status: 'ERROR',
      });
      setErrorMsg(err.message || '連線測試時發生未知錯誤。');
    } finally {
      setTesting(false);
    }
  };

  // 4. Save to Github Gist (PATCH schedule.json)
  const handleSaveToCloud = async () => {
    if (gistConfig.status !== 'CONNECTED') {
      setErrorMsg('請先完成「驗證並儲存設定」以建立連線！');
      return;
    }

    setActionLoading('push');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const stateToBackup = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        employees,
        leaveRecords,
        securityLogs,
      };

      const payload = {
        description: '團隊排休系統雲端自動備份資料',
        files: {
          'schedule.json': {
            content: JSON.stringify(stateToBackup, null, 2),
          },
        },
      };

      const res = await fetch(`https://api.github.com/gists/${gistConfig.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${gistConfig.githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`雲端寫入失敗 (狀態碼: ${res.status})，請確認 Token 與權限。`);
      }

      const syncTime = new Date().toLocaleString();
      onUpdateConfig({
        ...gistConfig,
        lastSynced: syncTime,
        status: 'CONNECTED',
      });

      onAddLog('雲端同步儲存', `上傳目前的數據至 GitHub Gist (schedule.json)。共計有 ${employees.length} 位員工、${leaveRecords.length} 筆假單。`);
      setSuccessMsg(`儲存成功！已於 ${syncTime} 同步更新至 GitHub 雲端。`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('上傳雲端失敗：' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 5. Restore from Github Gist (GET schedule.json)
  const handleRestoreFromCloud = async () => {
    if (gistConfig.status !== 'CONNECTED') {
      setErrorMsg('請先完成「驗證並儲存設定」以建立連線！');
      return;
    }

    if (!window.confirm('確定要從雲端還原嗎？這將會覆蓋您這台裝置上所有尚未備份的本地排班數據！')) {
      return;
    }

    setActionLoading('pull');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`https://api.github.com/gists/${gistConfig.gistId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${gistConfig.githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!res.ok) {
        throw new Error(`雲端獲取失敗 (狀態碼: ${res.status})，請確認網路連線或 Token 權限。`);
      }

      const GistData = await res.json();
      const backupFile = GistData.files?.['schedule.json'];

      if (!backupFile || !backupFile.content) {
        throw new Error('在您的 Gist 中找不到「schedule.json」備份檔案。請確認您是否曾經上傳過資料！');
      }

      const parsed = JSON.parse(backupFile.content);
      if (!parsed.employees || !parsed.leaveRecords) {
        throw new Error('雲端備份內容格式錯誤，無效的排班數據結構。');
      }

      // Restore
      onRestoreState({
        employees: parsed.employees,
        leaveRecords: parsed.leaveRecords,
        securityLogs: parsed.securityLogs || [],
      });

      const syncTime = new Date().toLocaleString();
      onUpdateConfig({
        ...gistConfig,
        lastSynced: syncTime,
        status: 'CONNECTED',
      });

      onAddLog('從雲端還原', `成功從 GitHub Gist 下載還原：覆蓋 ${parsed.employees.length} 位同仁資料及 ${parsed.leaveRecords.length} 筆休假資訊。`);
      setSuccessMsg('從雲端 Gist 還原成功！所有最新資料已同步。');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('從雲端拉取失敗：' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 6. Disconnect Cloud Mode
  const handleDisconnect = () => {
    if (window.confirm('確定要中斷與 GitHub Gist 的雲端連結嗎？這會重置為「純本地離線暫存模式」，但不會刪除您現有的排休資料。')) {
      onUpdateConfig({
        githubToken: '',
        gistId: '',
        lastSynced: '',
        status: 'UNCONFIGURED',
      });
      setPat('');
      setGistId('');
      onAddLog('中斷雲端連線', '已清除 LocalStorage 記憶的 PAT 與 Gist 識別碼，系統回復為【純本機暫存模式】。');
      setSuccessMsg('已中斷與 GitHub 的連結。');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <RefreshCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">資料備份與雲端雙軌同步</h3>
              <p className="text-xs text-slate-500">
                可選擇匯出至本機，或使用 GitHub Gist API 作為專屬無伺服器資料庫。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Messages Alert */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-3 p-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Local Backup */}
          <div className="p-5 border border-slate-200/80 rounded-xl bg-slate-50/30 space-y-3">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500" />
              1️⃣ 本地離線備份管理
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              最安全的隱私防線。將系統所有狀態（包含排班表、私有密碼、客製設定、安全日誌）打包成 JSON 檔下載。您隨時可以用此檔案還原至任何設備。
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleExportLocal}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                匯出下載備份 (JSON)
              </button>

              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shadow-sm border border-slate-200 transition-all cursor-pointer">
                <Upload className="w-4 h-4 text-slate-500" />
                上傳檔案還原 (JSON)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportLocal}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 2: GitHub Gist Cloud Sync */}
          <div className="border border-slate-200/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <Github className="w-4 h-4 text-slate-800" />
                2️⃣ GitHub Gist 雲端同步模式 (取代 Firebase)
              </h4>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border border-dotted ${
                  gistConfig.status === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : gistConfig.status === 'ERROR'
                    ? 'bg-rose-50 text-rose-600 border-rose-300'
                    : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}
              >
                {gistConfig.status === 'CONNECTED'
                  ? '已連線'
                  : gistConfig.status === 'ERROR'
                  ? '連線異常'
                  : '純本地暫存模式'}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              透過 GitHub Gist 作為您的多端雲端儲存庫。需提供具備 <code className="px-1 py-0.5 bg-slate-100 rounded text-rose-600 font-mono font-semibold">gist</code> 寫入權限的 Personal Access Token 填寫於下方。系統會自動讀寫 <code className="px-1.5 py-0.5 bg-slate-100 rounded text-indigo-700 font-mono font-semibold">schedule.json</code>。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1">
                  GitHub Personal Access Token (PAT)
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={pat}
                    onChange={(e) => setPat(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1">
                  GitHub Gist ID
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="32位十六進位字元 (e.g. 5d8363a0bb...)"
                  value={gistId}
                  onChange={(e) => setGistId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleVerifySettings}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-medium rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5" />
                  {testing ? '正在連線驗證...' : '驗證並儲存設定'}
                </button>

                {gistConfig.status === 'CONNECTED' && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-rose-600 border border-rose-200 text-xs font-medium rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    中斷連結
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>憑證及金鑰僅儲存於您的瀏覽器</span>
              </div>
            </div>

            {/* Cloud Operational Buttons (Only shown when state is CONNECTED or ERROR with stored values) */}
            {gistConfig.status === 'CONNECTED' && (
              <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>
                    雲端整合功能已啟用！最後成功同步：
                    <strong className="text-slate-800 ml-1">{gistConfig.lastSynced || '無紀錄'}</strong>
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleSaveToCloud}
                    className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 animate-bounce-slow" />
                    {actionLoading === 'push' ? '同步寫入中...' : '儲存到雲端 (PATCH)'}
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleRestoreFromCloud}
                    className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    {actionLoading === 'pull' ? '同步讀取中...' : '從雲端還原 (GET)'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick manual FAQ */}
          <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 flex gap-3 text-xs text-slate-600 leading-relaxed">
            <HelpCircle className="w-5 h-5 text-sky-500 shrink-0" />
            <div className="space-y-1">
              <strong className="text-slate-700">如何取得 PAT 與 Gist ID？</strong>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-500">
                <li>
                  登入 GitHub，前往 <strong>Settings &gt; Developer settings &gt; Personal Access Tokens &gt; Tokens (classic)</strong>。
                </li>
                <li>
                  點擊 Generate new token，勾選 <strong>gist</strong> 寫入權限，然後複製產生的 Token。
                </li>
                <li>
                  前往 <strong>gist.github.com</strong>，點擊右上角新增一個名稱為 <code className="px-1 bg-slate-200/50 rounded inline-block font-mono font-semibold">schedule.json</code> 的 Gist，儲存後在該 Gist 的網頁網址中複製 32 位元的十六進位代碼即為 Gist ID。
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-55 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
}
