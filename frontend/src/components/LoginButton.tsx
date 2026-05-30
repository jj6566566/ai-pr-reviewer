import { useAuth } from '../contexts/AuthContext';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

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
      <GitHubIcon className="w-4 h-4" />
      <span className="hidden sm:inline">GitHub 登录</span>
    </button>
  );
}
