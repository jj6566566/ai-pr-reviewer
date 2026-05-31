import { useState, useEffect } from "react"
import {
  Key,
  Shield,
  Save,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
} from "lucide-react"
import type { CustomRule } from "@/types/review"
import {
  fetchSettingsStatus,
  updateSettings,
  fetchRules,
  createRule,
  updateRule as apiUpdateRule,
  deleteRule,
} from "@/api/review"

type TabKey = "api-config" | "review-rules"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("api-config")

  const tabs = [
    { key: "api-config" as const, label: "API 配置", icon: Key },
    { key: "review-rules" as const, label: "自定义规则", icon: Shield },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e4e8f1]">系统设置</h2>
        <p className="text-sm text-[#7b829c] mt-1">配置外部服务和自定义评审规则</p>
      </div>

      <div className="flex gap-1 bg-[#0f1324] rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.key
                ? "bg-[#06d6a0]/10 text-[#06d6a0]"
                : "text-[#7b829c] hover:text-[#e4e8f1]"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "api-config" && <APIConfigPanel />}
      {activeTab === "review-rules" && <CustomRulesPanel />}
    </div>
  )
}

function maskKey(key: string): string {
  if (!key || key.length <= 8) return "****"
  return `${key.slice(0, 4)}${"*".repeat(Math.min(key.length - 8, 16))}${key.slice(-4)}`
}

function APIConfigPanel() {
  const [status, setStatus] = useState<{
    deepseek_configured: boolean
    github_configured: boolean
    deepseek_api_key?: string
    github_token?: string
  }>({ deepseek_configured: false, github_configured: false })
  const [deepseekKey, setDeepseekKey] = useState("")
  const [githubToken, setGithubToken] = useState("")
  const [showDeepseek, setShowDeepseek] = useState(false)
  const [showGithub, setShowGithub] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const loadStatus = () => {
    fetchSettingsStatus()
      .then(setStatus)
      .catch(() => {})
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleSave = async (key: "deepseek_api_key" | "github_token") => {
    setSaving(true)
    setMsg("")
    try {
      if (key === "deepseek_api_key") {
        await updateSettings({ deepseek_api_key: deepseekKey })
        setDeepseekKey("")
        setShowDeepseek(false)
        setMsg("DeepSeek API Key 已保存")
      } else {
        await updateSettings({ github_token: githubToken })
        setGithubToken("")
        setShowGithub(false)
        setMsg("GitHub Token 已保存")
      }
      loadStatus()
    } catch {
      setMsg("保存失败，请重试")
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#e4e8f1]">DeepSeek API Key</h3>
            <p className="text-xs text-[#7b829c] mt-0.5">用于 AI 代码评审的 LLM API 密钥</p>
          </div>
          <span className={`px-2 py-0.5 text-[11px] rounded-full border ${
            status.deepseek_configured
              ? "bg-[#06d6a0]/10 text-[#06d6a0] border-[#06d6a0]/30"
              : "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30"
          }`}>
            {status.deepseek_configured ? "已配置" : "未配置"}
          </span>
        </div>

        {showDeepseek ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="password"
                placeholder="sk-..."
                value={deepseekKey}
                onChange={(e) => setDeepseekKey(e.target.value)}
                className="w-full h-9 px-3 pr-8 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0]"
              />
              <button
                onClick={() => setShowDeepseek(!showDeepseek)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7b829c]"
              >
                <EyeOff size={14} />
              </button>
            </div>
            <button
              onClick={() => handleSave("deepseek_api_key")}
              disabled={!deepseekKey || saving}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-[#06d6a0] text-[#0a0e1a] rounded-lg hover:bg-[#05c090] disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              保存
            </button>
            <button
              onClick={() => setShowDeepseek(false)}
              className="px-3 py-2 text-xs text-[#7b829c] hover:text-[#e4e8f1]"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div>
            {status.deepseek_configured && status.deepseek_api_key && (
              <p className="text-xs text-[#7b829c] font-mono mb-2">
                {maskKey(status.deepseek_api_key)}
              </p>
            )}
            <button
              onClick={() => setShowDeepseek(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#06d6a0] bg-[#06d6a0]/5 border border-[#06d6a0]/20 rounded-lg hover:bg-[#06d6a0]/10"
            >
              <Plus size={12} />
              {status.deepseek_configured ? "更新 Key" : "配置 Key"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#e4e8f1]">GitHub Token</h3>
            <p className="text-xs text-[#7b829c] mt-0.5">用于访问 GitHub API 的访问令牌</p>
          </div>
          <span className={`px-2 py-0.5 text-[11px] rounded-full border ${
            status.github_configured
              ? "bg-[#06d6a0]/10 text-[#06d6a0] border-[#06d6a0]/30"
              : "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30"
          }`}>
            {status.github_configured ? "已配置" : "未配置"}
          </span>
        </div>

        {showGithub ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="password"
                placeholder="ghp_..."
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full h-9 px-3 pr-8 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0]"
              />
            </div>
            <button
              onClick={() => handleSave("github_token")}
              disabled={!githubToken || saving}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-[#06d6a0] text-[#0a0e1a] rounded-lg hover:bg-[#05c090] disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              保存
            </button>
            <button
              onClick={() => setShowGithub(false)}
              className="px-3 py-2 text-xs text-[#7b829c] hover:text-[#e4e8f1]"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div>
            {status.github_configured && status.github_token && (
              <p className="text-xs text-[#7b829c] font-mono mb-2">
                {maskKey(status.github_token)}
              </p>
            )}
            <button
              onClick={() => setShowGithub(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#06d6a0] bg-[#06d6a0]/5 border border-[#06d6a0]/20 rounded-lg hover:bg-[#06d6a0]/10"
            >
              <Plus size={12} />
              {status.github_configured ? "更新 Token" : "配置 Token"}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${
          msg.includes("失败") ? "bg-[#ef4444]/5 text-[#ef4444] border border-[#ef4444]/20" : "bg-[#06d6a0]/5 text-[#06d6a0] border border-[#06d6a0]/20"
        }`}>
          {msg}
        </div>
      )}
    </div>
  )
}

function CustomRulesPanel() {
  const [rules, setRules] = useState<CustomRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CustomRule | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{
    name: string
    description: string
    match_type: CustomRule["match_type"]
    match_pattern: string
    match_scope: CustomRule["match_scope"]
    file_filter: string
    severity: CustomRule["severity"]
    suggestion: string
    is_enabled: boolean
  }>({
    name: "",
    description: "",
    match_type: "text",
    match_pattern: "",
    match_scope: "added_lines",
    file_filter: "",
    severity: "medium",
    suggestion: "",
    is_enabled: true,
  })

  const loadRules = () => {
    setLoading(true)
    fetchRules()
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRules()
  }, [])

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      match_type: "text",
      match_pattern: "",
      match_scope: "added_lines",
      file_filter: "",
      severity: "medium",
      suggestion: "",
      is_enabled: true,
    })
    setCreating(false)
    setEditing(null)
  }

  const handleCreate = async () => {
    if (!form.name || !form.match_pattern) return
    try {
      await createRule({ ...form, is_preset: false })
      resetForm()
      loadRules()
    } catch {}
  }

  const handleUpdate = async () => {
    if (!editing || !form.name || !form.match_pattern) return
    try {
      await apiUpdateRule(editing.id, form)
      resetForm()
      loadRules()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteRule(id)
      loadRules()
    } catch {}
  }

  const handleToggle = async (rule: CustomRule) => {
    try {
      await apiUpdateRule(rule.id, { is_enabled: !rule.is_enabled })
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r))
      )
    } catch {
      loadRules()
    }
  }

  const startEdit = (rule: CustomRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      description: rule.description || "",
      match_type: rule.match_type,
      match_pattern: rule.match_pattern,
      match_scope: rule.match_scope,
      file_filter: rule.file_filter || "",
      severity: rule.severity,
      suggestion: rule.suggestion || "",
      is_enabled: rule.is_enabled,
    })
  }

  const severityColors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#3b82f6",
    low: "#06d6a0",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#e4e8f1]">
          自定义评审规则 ({rules.length})
        </h3>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#06d6a0]/10 text-[#06d6a0] border border-[#06d6a0]/20 rounded-lg hover:bg-[#06d6a0]/20"
        >
          <Plus size={14} />
          新建规则
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-[#131829] border border-[#06d6a0]/20 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-[#e4e8f1] mb-4">
            {creating ? "新建规则" : "编辑规则"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#7b829c] mb-1">名称 *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7b829c] mb-1">匹配模式 *</label>
              <input
                value={form.match_pattern}
                onChange={(e) => setForm((f) => ({ ...f, match_pattern: e.target.value }))}
                className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7b829c] mb-1">匹配类型</label>
              <select
                value={form.match_type}
                onChange={(e) => setForm((f) => ({ ...f, match_type: e.target.value as CustomRule["match_type"] }))}
                className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1]"
              >
                <option value="text">文本包含</option>
                <option value="regex">正则表达式</option>
                <option value="glob">Glob 模式</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b829c] mb-1">严重级别</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as CustomRule["severity"] }))}
                className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1]"
              >
                <option value="critical">致命</option>
                <option value="high">高危</option>
                <option value="medium">中等</option>
                <option value="low">建议</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b829c] mb-1">匹配范围</label>
              <select
                value={form.match_scope}
                onChange={(e) => setForm((f) => ({ ...f, match_scope: e.target.value as CustomRule["match_scope"] }))}
                className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1]"
              >
                <option value="added_lines">新增行</option>
                <option value="context_lines">上下文行</option>
                <option value="full_file">整个文件</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b829c] mb-1">文件过滤</label>
              <input
                value={form.file_filter}
                onChange={(e) => setForm((f) => ({ ...f, file_filter: e.target.value }))}
                placeholder="e.g. *.ts, src/** "
                className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0]"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-[#7b829c] mb-1">描述</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0]"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-[#7b829c] mb-1">修复建议</label>
            <input
              value={form.suggestion}
              onChange={(e) => setForm((f) => ({ ...f, suggestion: e.target.value }))}
              className="w-full h-9 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0]"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={creating ? handleCreate : handleUpdate}
              className="flex items-center gap-1 px-4 py-2 text-xs font-medium bg-[#06d6a0] text-[#0a0e1a] rounded-lg hover:bg-[#05c090]"
            >
              <Check size={14} />
              {creating ? "创建" : "保存"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-xs text-[#7b829c] hover:text-[#e4e8f1]"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#131829] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#7b829c]">
          暂无自定义规则，点击「新建规则」创建
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-[#131829] border rounded-xl p-4 transition-all ${
                rule.is_enabled ? "border-[#1e2440]" : "border-[#1e2440] opacity-50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[#e4e8f1]">{rule.name}</h4>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${severityColors[rule.severity]}15`,
                        color: severityColors[rule.severity],
                      }}
                    >
                      {rule.severity}
                    </span>
                    {rule.is_preset && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7c3aed]/10 text-[#7c3aed]">
                        预设
                      </span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-[#7b829c] mt-1">{rule.description}</p>
                  )}
                  <p className="text-xs text-[#4a5178] mt-1 font-mono">{rule.match_pattern}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  <button
                    onClick={() => handleToggle(rule)}
                    className={`w-9 h-6 rounded-full transition-colors relative ${
                      rule.is_enabled ? "bg-[#06d6a0]" : "bg-[#1e2440]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        rule.is_enabled ? "translate-x-4" : "translate-x-0.5"
                      }`}
                      style={{ left: 1 }}
                    />
                  </button>

                  {!rule.is_preset && (
                    <>
                      <button
                        onClick={() => startEdit(rule)}
                        className="p-1.5 rounded-lg text-[#7b829c] hover:text-[#06d6a0] hover:bg-[#0a0e1a]"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 rounded-lg text-[#7b829c] hover:text-[#ef4444] hover:bg-[#0a0e1a]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
