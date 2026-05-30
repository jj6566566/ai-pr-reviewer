import { useState, useCallback, useEffect } from 'react';
import { Zap, Search, Shield, CheckCircle2 } from 'lucide-react';
import CustomRulesPanel from './CustomRulesPanel';

interface ReviewMode {
  id: string;
  name: string;
  description: string;
  useCase: string;
  estimatedTime: string;
  coverage: string;
  icon: React.ElementType;
}

const REVIEW_MODES: ReviewMode[] = [
  {
    id: 'quick',
    name: '快速审查',
    description: '快速扫描PR变更，识别常见问题和代码规范违规',
    useCase: '日常代码审查、快速反馈',
    estimatedTime: '2-5 分钟',
    coverage: '代码规范、常见错误、命名检查',
    icon: Zap,
  },
  {
    id: 'deep',
    name: '深度分析',
    description: '全面分析代码变更，深度挖掘潜在风险与架构问题',
    useCase: '关键功能变更、重构审查',
    estimatedTime: '8-15 分钟',
    coverage: '安全漏洞、性能瓶颈、架构设计',
    icon: Search,
  },
  {
    id: 'security',
    name: '安全审计',
    description: '专项安全漏洞扫描与CWE/CVE映射，检测敏感数据泄露',
    useCase: '安全关键系统、合规审计',
    estimatedTime: '5-10 分钟',
    coverage: '安全漏洞、CWE/CVE、敏感数据泄露',
    icon: Shield,
  },
];

const STORAGE_KEY = 'pr_review_mode';

function loadMode(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && REVIEW_MODES.some((m) => m.id === stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return REVIEW_MODES[0].id;
}

function saveMode(mode: string) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage 不可用时忽略
  }
}

export default function ReviewModesPanel() {
  const [selectedMode, setSelectedMode] = useState<string>(loadMode);

  const handleSelect = useCallback((modeId: string) => {
    setSelectedMode(modeId);
    saveMode(modeId);
  }, []);

  useEffect(() => {
    const syncMode = () => setSelectedMode(loadMode());
    window.addEventListener('storage', syncMode);
    return () => window.removeEventListener('storage', syncMode);
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-5">评审模式</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REVIEW_MODES.map((mode) => {
            const isSelected = selectedMode === mode.id;
            const Icon = mode.icon;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSelect(mode.id)}
                className={`relative rounded-xl border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-violet-500/60 bg-violet-950/20 shadow-lg shadow-violet-500/5'
                    : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 hover:bg-slate-800/60'
                }`}
              >
                {isSelected && (
                  <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-violet-400" />
                )}

                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                    isSelected
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'bg-slate-700/50 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <h3 className={`text-sm font-semibold mb-2 ${isSelected ? 'text-violet-300' : 'text-slate-200'}`}>
                  {mode.name}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {mode.description}
                </p>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">适用场景</span>
                    <span className="text-slate-300">{mode.useCase}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">预计耗时</span>
                    <span className="text-slate-300">{mode.estimatedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">覆盖范围</span>
                    <span className="text-slate-300">{mode.coverage}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <CustomRulesPanel />
    </div>
  );
}
