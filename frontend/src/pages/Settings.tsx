import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomRulesPanel from '../components/CustomRulesPanel';

export default function Settings() {
  const navigate = useNavigate();

  const NAV_ITEMS = [
    { id: 'review-modes', label: '评审模式', active: true },
    { id: 'api-config', label: 'API 配置', active: false },
    { id: 'notifications', label: '通知设置', active: false },
    { id: 'system', label: '系统参数', active: false },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回 Dashboard
          </button>
          <h1 className="text-lg font-semibold text-slate-200">系统设置</h1>
        </div>

        <div className="flex gap-6">
          <nav className="w-48 flex-shrink-0">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 overflow-hidden">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.active}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    item.active
                      ? 'text-slate-200 bg-slate-700/50'
                      : 'text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          <main className="flex-1 min-w-0">
            <CustomRulesPanel />
          </main>
        </div>
      </div>
    </div>
  );
}
