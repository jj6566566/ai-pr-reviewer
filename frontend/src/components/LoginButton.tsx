import { Github } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginButton() {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />;
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        <img
          src={user.avatar_url || ''}
          alt={user.login}
          className="w-7 h-7 rounded-full ring-1 ring-slate-600"
        />
        <span className="text-sm text-slate-300 hidden sm:inline">{user.login}</span>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={login}
      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium
                 bg-slate-800 border border-slate-700 text-slate-300
                 hover:bg-slate-700 hover:border-slate-600 hover:text-white
                 transition-all duration-200"
    >
      <Github className="w-4 h-4" />
      <span className="hidden sm:inline">GitHub 登录</span>
    </button>
  );
}
