import { useState } from 'react';
import { ArrowLeft, Sliders, Key, Bell, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReviewModesPanel from '../components/ReviewModesPanel';
import APIConfigPanel from '../components/APIConfigPanel';

type TabId = 'review-modes' | 'api-config' | 'notifications' | 'system';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'review-modes', label: '评审模式', icon: Sliders },
  { id: 'api-config', label: 'API 配置', icon: Key },
  { id: 'notifications', label: '通知设置', icon: Bell },
  { id: 'system', label: '系统参数', icon: Settings2 },
];

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('review-modes');

  const renderContent = () => {
    switch (activeTab) {
      case 'review-modes':
        return <ReviewModesPanel />;
      case 'api-config':
        return <APIConfigPanel />;
      case 'notifications':
        return (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-8 text-center">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">通知设置</h3>
            <p className="text-sm text-slate-500">邮件通知、Webhook 集成等功能即将推出</p>
          </div>
        );
      case 'system':
        return (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-8 text-center">
            <Settings2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">系统参数</h3>
            <p className="text-sm text-slate-500">并发控制、超时设置等全局参数配置即将推出</p>
          </div>
        );
      default:
        return null;
    }
  };

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
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                      isActive
                        ? 'text-slate-200 bg-slate-700/50 border-l-2 border-violet-500'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-violet-400' : 'text-slate-500'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <main className="flex-1 min-w-0">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
