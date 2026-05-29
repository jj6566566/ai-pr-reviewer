import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react';
import { Loader2, Search, Plus, Pencil, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { fetchRules, createRule, updateRule, deleteRule } from '../api/review';
import type { CustomRule, RiskSeverity } from '../types/review';
import { RISK_SEVERITY_CONFIG } from '../types/review';

const RULE_MATCH_TYPE_LABELS: Record<string, string> = {
  text: '纯文本',
  regex: '正则',
  glob: 'Glob',
};

const RULE_SCOPE_LABELS: Record<string, string> = {
  added_lines: '仅新增行',
  context_lines: '上下文行',
  full_file: '全文件',
};

const emptyRuleForm = {
  name: '',
  description: '',
  match_type: 'text' as const,
  match_pattern: '',
  match_scope: 'added_lines' as const,
  file_filter: '',
  severity: 'medium' as const,
  suggestion: '',
  is_enabled: true,
};

export default function CustomRulesPanel() {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);
  const [form, setForm] = useState({ ...emptyRuleForm });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError('');
    try {
      const data = await fetchRules();
      setRules(data);
    } catch (err: unknown) {
      setRulesError(err instanceof Error ? err.message : '加载规则失败');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const presetRules = useMemo(() => rules.filter((r) => r.is_preset), [rules]);
  const customRules = useMemo(() => rules.filter((r) => !r.is_preset), [rules]);

  const resetForm = () => {
    setForm({ ...emptyRuleForm });
    setShowCreateForm(false);
    setEditingRule(null);
    setFormError('');
  };

  const handleCreateClick = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const handleEditClick = (rule: CustomRule) => {
    setForm({
      name: rule.name,
      description: rule.description || '',
      match_type: rule.match_type,
      match_pattern: rule.match_pattern,
      match_scope: rule.match_scope,
      file_filter: rule.file_filter || '',
      severity: rule.severity,
      suggestion: rule.suggestion || '',
      is_enabled: rule.is_enabled,
    });
    setEditingRule(rule);
    setShowCreateForm(true);
    setFormError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.match_pattern.trim()) {
      setFormError('名称和匹配模式为必填项');
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        match_type: form.match_type,
        match_pattern: form.match_pattern.trim(),
        match_scope: form.match_scope,
        file_filter: form.file_filter.trim() || null,
        severity: form.severity,
        suggestion: form.suggestion.trim() || null,
        is_enabled: form.is_enabled,
      };
      if (editingRule) {
        await updateRule(editingRule.id, payload);
      } else {
        await createRule(payload as Omit<CustomRule, 'id' | 'created_at' | 'updated_at'>);
      }
      resetForm();
      await loadRules();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteRule(id);
      await loadRules();
    } catch (err: unknown) {
      setRulesError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (rule: CustomRule) => {
    const prevEnabled = rule.is_enabled;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r))
    );
    try {
      await updateRule(rule.id, { is_enabled: !prevEnabled });
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_enabled: prevEnabled } : r))
      );
    }
  };

  const inputClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30';

  const selectClass =
    'bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30';

  const severityOptions: { value: string; label: string }[] = [
    { value: 'critical', label: '严重' },
    { value: 'high', label: '高危' },
    { value: 'medium', label: '中等' },
    { value: 'low', label: '低' },
  ];

  const renderRuleCard = (rule: CustomRule) => {
    const sevConfig = RISK_SEVERITY_CONFIG[rule.severity as RiskSeverity] ?? RISK_SEVERITY_CONFIG.medium;
    const isDeleting = deletingId === rule.id;

    return (
      <div
        key={rule.id}
        className={`rounded-lg border ${sevConfig.borderClass} ${sevConfig.bgClass} p-4 transition-colors`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sevConfig.textClass} bg-slate-900/40`}
              >
                {sevConfig.label}
              </span>
              <span className="text-sm font-semibold text-slate-200 truncate">
                {rule.name}
              </span>
              {rule.is_preset && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-950/60 text-violet-400 border border-violet-500/30">
                  预设
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(rule);
                }}
                className={`inline-flex items-center gap-1 text-[11px] ml-auto px-2 py-1 rounded-md transition-colors ${
                  rule.is_enabled
                    ? 'text-emerald-400 hover:bg-emerald-950/30'
                    : 'text-slate-500 hover:bg-slate-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    rule.is_enabled ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
                {rule.is_enabled ? '已启用' : '已禁用'}
              </button>
            </div>

            {rule.description && (
              <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                {rule.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-600">匹配:</span>
                <code className="text-sky-400/80 bg-slate-900/50 px-1 rounded">
                  {rule.match_pattern}
                </code>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                {RULE_MATCH_TYPE_LABELS[rule.match_type] ?? rule.match_type}
              </span>
              <span className="text-slate-600">|</span>
              <span>
                {RULE_SCOPE_LABELS[rule.match_scope] ?? rule.match_scope}
              </span>
              {rule.file_filter && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-500 truncate max-w-[160px]">
                    {rule.file_filter}
                  </span>
                </>
              )}
            </div>
          </div>

          {!rule.is_preset && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleEditClick(rule)}
                className="p-1.5 rounded-md text-slate-500 hover:text-sky-400 hover:bg-sky-950/30 transition-colors"
                title="编辑"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(rule.id)}
                disabled={isDeleting}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
                title="删除"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto mb-10">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            自定义规则管理
          </h2>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 text-white text-xs font-semibold hover:from-sky-400 hover:to-violet-400 transition-all duration-200 shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            创建规则
          </button>
        </div>

        {rulesLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">加载规则中...</span>
          </div>
        )}

        {rulesError && (
          <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-4 text-center mb-4">
            <p className="text-sm text-red-400 mb-3">{rulesError}</p>
            <button
              onClick={loadRules}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
            >
              <Search className="w-3 h-3" />
              重试
            </button>
          </div>
        )}

        {!rulesLoading && !rulesError && (
          <>
            {presetRules.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-violet-400" />
                  预设规则（不可删除）
                  <span className="text-xs text-slate-600 ml-1">
                    {presetRules.length} 条
                  </span>
                </h3>
                <div className="space-y-3">
                  {presetRules.map(renderRuleCard)}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-sky-400" />
                自定义规则
                <span className="text-xs text-slate-600 ml-1">
                  {customRules.length} 条
                </span>
              </h3>
              <div className="space-y-3">
                {customRules.map(renderRuleCard)}
              </div>
            </div>
          </>
        )}

        {!rulesLoading && !rulesError && customRules.length === 0 && (
          <button
            onClick={handleCreateClick}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-4 border border-dashed border-slate-600/50 text-slate-500 text-sm hover:border-sky-500/40 hover:text-sky-400 transition-all duration-200 mt-3"
          >
            <Plus className="w-4 h-4" />
            新建规则
          </button>
        )}

        {showCreateForm && (
          <div className="mt-6 border-t border-slate-700/50 pt-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              {editingRule ? '编辑规则' : '创建规则'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {formError && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="规则名称"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="可选描述"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    匹配类型
                  </label>
                  <select
                    value={form.match_type}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        match_type: e.target.value as 'text' | 'regex' | 'glob',
                      }))
                    }
                    className={selectClass + ' w-full'}
                  >
                    <option value="text">纯文本</option>
                    <option value="regex">正则表达式</option>
                    <option value="glob">Glob</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    匹配范围
                  </label>
                  <select
                    value={form.match_scope}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        match_scope: e.target.value as 'added_lines' | 'context_lines' | 'full_file',
                      }))
                    }
                    className={selectClass + ' w-full'}
                  >
                    <option value="added_lines">仅新增行</option>
                    <option value="context_lines">上下文行</option>
                    <option value="full_file">全文件</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    匹配模式 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.match_pattern}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, match_pattern: e.target.value }))
                    }
                    placeholder="例如: console\.log\( 或 *.log"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    严重度
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        severity: e.target.value as 'critical' | 'high' | 'medium' | 'low',
                      }))
                    }
                    className={selectClass + ' w-full'}
                  >
                    {severityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    文件过滤（可选）
                  </label>
                  <input
                    type="text"
                    value={form.file_filter}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, file_filter: e.target.value }))
                    }
                    placeholder="例如: src/**/*.ts"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    修复建议（可选）
                  </label>
                  <input
                    type="text"
                    value={form.suggestion}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, suggestion: e.target.value }))
                    }
                    placeholder="命中时给出的建议"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_enabled}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, is_enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500/30"
                    />
                    <span className="text-sm text-slate-300">启用规则</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 text-white text-sm font-semibold hover:from-sky-400 hover:to-violet-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {editingRule ? '保存修改' : '创建规则'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
