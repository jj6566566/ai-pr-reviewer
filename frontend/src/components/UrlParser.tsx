import { useState, useMemo } from 'react';

interface ParsedPR {
  repo_owner: string;
  repo_name: string;
  pr_number: number;
  raw: string;
  valid: boolean;
  error?: string;
}

interface UrlParserProps {
  onConfirm: (items: { repo_owner: string; repo_name: string; pr_number: number }[]) => void;
}

const PR_URL_REGEX = /github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/pull\/(\d+)/g;

function parsePRs(text: string): ParsedPR[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');

  const seen = new Set<string>();
  const result: ParsedPR[] = [];

  for (const line of lines) {
    PR_URL_REGEX.lastIndex = 0;
    const match = PR_URL_REGEX.exec(line);

    if (!match) {
      result.push({
        repo_owner: '',
        repo_name: '',
        pr_number: 0,
        raw: line,
        valid: false,
        error: '无法解析的 URL',
      });
      continue;
    }

    const repo_owner = match[1];
    const repo_name = match[2];
    const pr_number = parseInt(match[3], 10);
    const key = `${repo_owner}/${repo_name}#${pr_number}`;

    if (seen.has(key)) {
      result.push({
        repo_owner,
        repo_name,
        pr_number,
        raw: line,
        valid: false,
        error: '重复',
      });
    } else {
      seen.add(key);
      result.push({
        repo_owner,
        repo_name,
        pr_number,
        raw: line,
        valid: true,
      });
    }
  }

  return result;
}

export default function UrlParser({ onConfirm }: UrlParserProps) {
  const [text, setText] = useState('');

  const parsedList = useMemo<ParsedPR[]>(() => parsePRs(text), [text]);

  const validCount = parsedList.filter((p) => p.valid).length;

  const handleRemove = (raw: string) => {
    const lines = text.split('\n').filter((l) => l.trim() !== raw);
    setText(lines.join('\n'));
  };

  const handleSubmit = () => {
    const items = parsedList
      .filter((p) => p.valid)
      .map(({ repo_owner, repo_name, pr_number }) => ({ repo_owner, repo_name, pr_number }));
    onConfirm(items);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M12 11v6M9 14h6" />
        </svg>
        <h2 className="text-sm font-semibold text-slate-300">粘贴 GitHub PR URL 列表，每行一个</h2>
      </div>

      <textarea
        className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 resize-none"
        placeholder={`https://github.com/owner/repo/pull/123\nhttps://github.com/owner/repo/pull/456`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {parsedList.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/60">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-10">状态</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Owner</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Repo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">PR</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {parsedList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2">
                      {item.valid ? (
                        <span className="text-emerald-400">&#10003;</span>
                      ) : item.error === '重复' ? (
                        <span className="text-yellow-400">&#9888;</span>
                      ) : (
                        <span className="text-red-400">&#10007;</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 font-mono ${item.valid ? 'text-slate-200' : item.error === '重复' ? 'text-yellow-400/70' : 'text-red-400/70'}`}
                    >
                      {item.repo_owner || '--'}
                    </td>
                    <td
                      className={`px-3 py-2 font-mono ${item.valid ? 'text-slate-200' : item.error === '重复' ? 'text-yellow-400/70' : 'text-red-400/70'}`}
                    >
                      {item.repo_name || '--'}
                    </td>
                    <td
                      className={`px-3 py-2 font-mono ${item.valid ? 'text-slate-200' : item.error === '重复' ? 'text-yellow-400/70' : 'text-red-400/70'}`}
                    >
                      {item.valid ? `#${item.pr_number}` : item.raw.length > 30 ? `${item.raw.substring(0, 30)}...` : item.raw}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleRemove(item.raw)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="移除"
                      >
                        &#10005;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={validCount === 0}
        className="mt-3 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        开始批量分析 ({validCount} 个有效 PR)
      </button>
    </div>
  );
}
