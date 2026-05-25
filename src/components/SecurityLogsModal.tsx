import React, { useState } from 'react';
import { SecurityLog } from '../types';
import { X, Search, Trash2, Download, ShieldCheck, Clock, User } from 'lucide-react';

interface SecurityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SecurityLog[];
  onClearLogs: () => void;
}

export default function SecurityLogsModal({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}: SecurityLogsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOperator, setFilterOperator] = useState('ALL');

  if (!isOpen) return null;

  // Filter logs
  const filteredLogs = logs
    .filter((log) => {
      const matchSearch =
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.operator.toLowerCase().includes(searchTerm.toLowerCase());
      const matchOperator =
        filterOperator === 'ALL' || log.operator === filterOperator;
      return matchSearch && matchOperator;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Get distinct operators for filter dropdown
  const operators = Array.from(new Set(logs.map((l) => l.operator)));

  // Export logs to CSV
  const handleExportCSV = () => {
    try {
      const headers = ['時間', '執行人員', '操作類別', '詳細內容描述'];
      const csvRows = [headers.join(',')];

      filteredLogs.forEach((log) => {
        const row = [
          new Date(log.timestamp).toLocaleString(),
          `"${log.operator.replace(/"/g, '""')}"`,
          `"${log.action.replace(/"/g, '""')}"`,
          `"${log.details.replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `學排休操作紀錄日誌_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('匯出 CSV 失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">安全稽核與系統操作日誌</h3>
              <p className="text-xs text-slate-500">
                本系統採最高安全等級防護，詳實記錄每筆排班異動與雲端同步行為。
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

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="搜尋日誌內容/動作..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 min-w-[120px]"
            >
              <option value="ALL">全體操作人員</option>
              {operators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>

            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              匯出 CSV
            </button>

            <button
              onClick={() => {
                if (window.confirm('確定要清空所有的稽核操作日誌嗎？此動作將無法復原！')) {
                  onClearLogs();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <ShieldCheck className="w-12 h-12 text-slate-300 stroke-1 mb-2" />
              <p className="text-xs">找不到符合特定條件的日誌記錄</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm hover:border-slate-200 transition-all flex flex-col md:flex-row md:items-start justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/50">
                        {log.action}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">{log.details}</p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1 self-start md:self-auto bg-indigo-50/50 text-indigo-700 border border-indigo-100/60 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                    <User className="w-3 h-3" />
                    <span>{log.operator}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center text-[11px] text-slate-400">
          <span>共顯示 {filteredLogs.length} / {logs.length} 筆稽核記錄</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
