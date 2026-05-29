import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Loader2, Pencil, Save, X, Key, RefreshCw } from 'lucide-react';

interface SettingsStatus {
  deepseek_api_key: string;
  github_token: string;
  deepseek_base_url: string;
}

interface SettingsPayload {
  deepseek_api_key?: string;
  github_token?: string;
  deepseek_base_url?: string;
}

type ConfigKey = 'deepseek_api_key' | 'github_token';

interface ConfigField {
  key: ConfigKey;
  label: string;
  description: string;
}

const CONFIG_FIELDS: ConfigField[] = [
  {
    key: 'deepseek_api_key',
    label: 'DeepSeek API Key',
    description: '用于调用 DeepSeek AI 模型进行代码评审分析',
  },
  {
    key: 'github_token',
    label: 'GitHub Token',
    description: '用于访问 GitHub API 获取 PR 详情和代码变更',
  },
];

function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return value.slice(0, 4) + '*'.repeat(Math.min(value.length - 8, 12)) + value.slice(-4);
}

export default function APIConfigPanel() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingField, setEditingField] = useState<ConfigKey | null>(null);
  const [formValue, setFormValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('pr_review_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch('/api/settings/status', { headers });
      if (!response.ok) {
        throw new Error(`请求失败 (HTTP ${response.status})`);
      }
      const data: SettingsStatus = await response.json();
      setStatus(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载配置状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleEdit = (key: ConfigKey) => {
    setFormValue('');
    setEditingField(key);
    setSaveError('');
  };

  const handleCancel = () => {
    setEditingField(null);
    setFormValue('');
    setSaveError('');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValue.trim()) {
      setSaveError('请输入有效值');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const token = localStorage.getItem('pr_review_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const payload: SettingsPayload = {};
      if (editingField === 'deepseek_api_key') {
        payload.deepseek_api_key = formValue.trim();
      } else if (editingField === 'github_token') {
        payload.github_token = formValue.trim();
      }
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error((errBody as { detail?: string }).detail || `保存失败 (HTTP ${response.status})`);
      }
      setEditingField(null);
      setFormValue('');
      await fetchStatus();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-8">
        <div className="flex items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
          <span className="text-sm">加载配置状态...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-950/30 flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchStatus}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-5 flex items-center gap-2">
        <Key className="w-5 h-5 text-violet-400" />
        API 配置
      </h2>

      <div className="space-y-4">
        {CONFIG_FIELDS.map((field) => {
          const realValue = status?.[field.key] ?? '';
          const isConfigured = realValue.length > 0;
          const isEditing = editingField === field.key;

          return (
            <div
              key={field.key}
              className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-sm font-semibold text-slate-200">
                      {field.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        isConfigured
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/40 text-slate-500 border border-slate-600/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isConfigured ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      {isConfigured ? '已配置' : '未配置'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{field.description}</p>

                  {isEditing ? (
                    <form onSubmit={handleSave} className="space-y-2">
                      <input
                        type="password"
                        value={formValue}
                        onChange={(e) => setFormValue(e.target.value)}
                        placeholder={`输入新的 ${field.label}`}
                        autoFocus
                        className="w-full bg-slate-900/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
                      />
                      {saveError && (
                        <p className="text-xs text-red-400">{saveError}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 text-white text-xs font-semibold hover:from-sky-400 hover:to-violet-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              保存中...
                            </>
                          ) : (
                            <>
                              <Save className="w-3 h-3" />
                              保存
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs hover:bg-slate-700 transition-colors disabled:opacity-40"
                        >
                          <X className="w-3 h-3" />
                          取消
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded font-mono">
                        {isConfigured ? maskValue(realValue) : '---'}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleEdit(field.key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-slate-400 hover:text-sky-400 hover:bg-sky-950/30 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        {isConfigured ? '修改' : '配置'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
