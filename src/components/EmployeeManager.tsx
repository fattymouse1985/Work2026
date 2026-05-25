import React, { useState } from 'react';
import { Employee, Role } from '../types';
import { X, Plus, Trash2, Key, Palette, User, ShieldAlert, CheckCircle, Info } from 'lucide-react';
import { ROLE_LABELS, ROLE_BADGES } from '../data';

interface EmployeeManagerProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployees: (employees: Employee[]) => void;
  onAddLog: (action: string, details: string) => void;
  currentLoginUser: Employee | null;
}

const PRESET_COLORS = [
  { hex: '#ef4444', label: '玫瑰紅', bg: 'bg-red-50 text-red-700 border-red-200' },
  { hex: '#f97316', label: '活力橘', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  { hex: '#ca8a04', label: '磚橘黃', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
  { hex: '#84cc16', label: '萊姆綠', bg: 'bg-lime-50 text-lime-700 border-lime-200' },
  { hex: '#10b981', label: '薄荷綠', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { hex: '#06b6d4', label: '青碧藍', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { hex: '#3b82f6', label: '靛青藍', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { hex: '#8b5cf6', label: '丁香紫', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { hex: '#ec4899', label: '桃花粉', bg: 'bg-pink-50 text-pink-700 border-pink-200' },
  { hex: '#64748b', label: '石岩灰', bg: 'bg-slate-100 text-slate-800 border-slate-300' },
];

export default function EmployeeManager({
  isOpen,
  onClose,
  employees,
  onAddEmployee,
  onUpdateEmployees,
  onAddLog,
  currentLoginUser,
}: EmployeeManagerProps) {
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<Role>('CLEANER');
  const [newEmpPwd, setNewEmpPwd] = useState('1234');
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);

  // Checks if logged in user is authorized
  const isAuthorized =
    currentLoginUser?.role === 'ADMIN' || currentLoginUser?.role === 'MANAGER';

  if (!isOpen) return null;

  // 1. Submit New Staff
  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      alert('無權限辦理！僅管理員或主管級身分能調用此控制項。');
      return;
    }

    const nameTrim = newEmpName.trim();
    if (!nameTrim) {
      alert('請填寫員工姓名！');
      return;
    }

    if (employees.some((emp) => emp.name === nameTrim)) {
      alert(`已存在姓名為「${nameTrim}」的同仁，請輸入完整姓名或加上辨識字元！`);
      return;
    }

    if (newEmpPwd.length !== 4 || isNaN(Number(newEmpPwd))) {
      alert('請設定 4 位數純數字密碼！');
      return;
    }

    const colorPreset = PRESET_COLORS[selectedColorIdx];
    const newEmp: Employee = {
      id: `emp-custom-${Date.now()}`,
      name: nameTrim,
      role: newEmpRole,
      password: newEmpPwd,
      color: colorPreset.hex,
      textColor: '#ffffff',
      bgColor: colorPreset.bg,
    };

    onAddEmployee(newEmp);
    onAddLog(
      '新增員工成員',
      `新增同仁「${newEmp.name}」(${ROLE_LABELS[newEmp.role]})，預設密碼 ${newEmp.password}，配色 ${colorPreset.label}。`
    );

    // Reset Form
    setNewEmpName('');
    setNewEmpRole('CLEANER');
    setNewEmpPwd('1234');
    setSelectedColorIdx(0);
  };

  // 2. Edit existing employee fields (e.g. Password or role or color)
  const handleUpdateField = (
    empId: string,
    field: keyof Employee,
    value: any
  ) => {
    if (!isAuthorized) {
      alert('無修改權限！');
      return;
    }

    const empToChange = employees.find((e) => e.id === empId);
    if (!empToChange) return;

    const originalVal = empToChange[field];
    
    const updatedEmployees = employees.map((emp) => {
      if (emp.id === empId) {
        const updated = { ...emp, [field]: value };
        // If color changes, match the Tailwind class as well
        if (field === 'color') {
          const matchPreset = PRESET_COLORS.find((p) => p.hex === value);
          if (matchPreset) {
            updated.bgColor = matchPreset.bg;
          }
        }
        return updated;
      }
      return emp;
    });

    onUpdateEmployees(updatedEmployees);
    onAddLog(
      '更新成員資訊',
      `修改員工「${empToChange.name}」的【${String(field)}】，由 ${String(originalVal)} 改為 ${String(value)}。`
    );
  };

  // 3. Remove employee handler
  const handleRemove = (empId: string, empName: string) => {
    if (!isAuthorized) {
      alert('無刪除權限！');
      return;
    }

    if (empName === '系統管理員' || empId === 'emp-10') {
      alert('禁止刪除系統根層級管理員！');
      return;
    }

    if (currentLoginUser?.id === empId) {
      alert('不可自我投降刪除！請切換其他管理帳號進行成員裁撤。');
      return;
    }

    if (
      window.confirm(
        `您確定要刪除員工「${empName}」嗎？該員過往排休歷史將可能造成未對齊之缺口。`
      )
    ) {
      const remaining = employees.filter((emp) => emp.id !== empId);
      onUpdateEmployees(remaining);
      onAddLog('刪除員工成員', `裁撤排班同仁「${empName}」及其系統登入識別口令。`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">員工名冊與調度中心</h3>
              <p className="text-xs text-slate-500">
                {isAuthorized
                  ? '主管解鎖模式：您擁有完整檢視、新增口令以及修訂專屬配色的權限。'
                  : '一般權限模式：您可在此檢視同仁配色與配置。變動設定需先切換主管/管理員。'}
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

        {/* Content Bento Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Col 1: Add new employee form (Only if authorized) */}
          <div className="md:col-span-2 space-y-4">
            {isAuthorized ? (
              <form
                onSubmit={handleSubmitNew}
                className="p-4 border border-indigo-100 rounded-xl bg-indigo-50/25 space-y-3.5"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-indigo-950">新增團隊同仁</h4>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    同仁姓名
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="姓名 (e.g. 阮小娟)"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      組別角色
                    </label>
                    <select
                      value={newEmpRole}
                      onChange={(e) => setNewEmpRole(e.target.value as Role)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                    >
                      <option value="CLEANER">清潔人員</option>
                      <option value="RECEPTION">櫃台人員</option>
                      <option value="PART_TIME">工讀生</option>
                      <option value="MANAGER">主管</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                      登錄密碼 (4碼)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="1234"
                      value={newEmpPwd}
                      onChange={(e) => setNewEmpPwd(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-center font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* Color Selection Presets */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600 flex justify-between">
                    <span>專屬視覺色彩</span>
                    <span className="text-[10px] text-indigo-600 font-medium font-sans">
                      {PRESET_COLORS[selectedColorIdx].label}
                    </span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_COLORS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedColorIdx(idx)}
                        style={{ backgroundColor: preset.hex }}
                        className={`h-6 rounded-md relative cursor-pointer group transition-transform hover:scale-105 ${
                          selectedColorIdx === idx
                            ? 'ring-2 ring-indigo-600 ring-offset-1 scale-110'
                            : 'opacity-85'
                        }`}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center inline-flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  確認登錄並加入
                </button>
              </form>
            ) : (
              <div className="p-4 border border-amber-100 bg-amber-50/50 rounded-xl space-y-2 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  權限提示 (鎖定)
                </div>
                <p>
                  您目前的登入身分 <strong>{currentLoginUser?.name || '未登入'}</strong> 是 <strong>{ROLE_LABELS[currentLoginUser?.role as Role] || '訪客'}</strong>，不具備同仁名簿修訂特許。
                </p>
                <div className="text-[11px] text-slate-500 pt-1">
                  請至右上角切換登入為 <strong>系統管理員 (ADMIN)</strong> 或 <strong>主管 (MANAGER)</strong> 開啟增修。
                </div>
              </div>
            )}

            <div className="p-3.5 border border-slate-100 rounded-xl bg-slate-50 text-[11px] leading-relaxed text-slate-500 flex gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700">排班限制守則：</span>
                <ul className="list-disc pl-3.5 space-y-0.5 mt-1 text-[10px]">
                  <li>
                    <strong className="text-red-700">清潔人員 (CLEANER)</strong>：每天有「最多 1 人排休」的限制。
                  </li>
                  <li>
                    櫃台、工讀生、主管不設每日排班人數上限。
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Col 2: Employee List with quick edits */}
          <div className="md:col-span-3 space-y-3.5">
            <h4 className="text-xs font-semibold text-slate-600 tracking-wider uppercase">
              名冊一覽 ({employees.length} 人)
            </h4>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left info: color circle + name + role badge */}
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{ backgroundColor: emp.color }}
                      className="w-4 h-4 rounded-full border border-white ring-2 ring-slate-100 shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                        {emp.name}
                        <span
                          className={`text-[10px] scale-95 font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGES[emp.role]}`}
                        >
                          {ROLE_LABELS[emp.role]}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: {emp.id}
                      </div>
                    </div>
                  </div>

                  {/* Right: Inline inputs for authorized admins, else readonly status */}
                  {isAuthorized ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Password Edit */}
                      <div className="flex items-center gap-1 inline-flex bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono">
                        <Key className="w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          maxLength={4}
                          value={emp.password}
                          title="修改密碼口令"
                          onChange={(e) =>
                            handleUpdateField(
                              emp.id,
                              'password',
                              e.target.value.replace(/\D/g, '')
                            )
                          }
                          className="w-10 bg-transparent text-slate-700 text-center focus:outline-none"
                        />
                      </div>

                      {/* Group Role Switcher */}
                      <select
                        value={emp.role}
                        onChange={(e) =>
                          handleUpdateField(emp.id, 'role', e.target.value as Role)
                        }
                        className="py-0.5 px-1.5 text-[11px] border border-slate-200 bg-slate-50 rounded text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="CLEANER">清潔人員</option>
                        <option value="RECEPTION">櫃台人員</option>
                        <option value="PART_TIME">工讀生</option>
                        <option value="MANAGER">主管</option>
                      </select>

                      {/* Color preset picker dropdown */}
                      <select
                        value={emp.color}
                        onChange={(e) =>
                          handleUpdateField(emp.id, 'color', e.target.value)
                        }
                        className="py-0.5 px-1 bg-slate-50 rounded text-[11px] border border-slate-200 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {PRESET_COLORS.map((color) => (
                          <option key={color.hex} value={color.hex}>
                            {color.label}
                          </option>
                        ))}
                      </select>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemove(emp.id, emp.name)}
                        className="p-1 px-1.5 text-rose-600 hover:text-white hover:bg-rose-500 rounded border border-rose-100 hover:border-transparent transition-all cursor-pointer"
                        title="裁撤成員"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 flex-row">
                      <span className="font-mono bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded">
                        密碼: ****
                      </span>
                      <span className="font-mono bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded">
                        顏色碼: {emp.color}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
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
