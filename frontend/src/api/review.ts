/**
 * @file src/api/review.ts
 * @description AI PR Review API 调用封装
 */

import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalyzeResult,
  HistoryItem,
  HistoryDetail,
  BatchAnalyzeItem,
  BatchAnalyzeResponse,
  ReviewMode,
} from '../types/review';

/** API 基础路径（通过 Vite proxy 转发到后端） */
const API_BASE = '/api';

/**
 * 发起 PR 分析请求
 * @param params - owner、repo、prNumber 参数
 * @returns 分析结果（成功则包含后端数据，失败则包含错误信息）
 */
export async function analyzePR(params: AnalyzeRequest): Promise<AnalyzeResult> {
  const { owner, repo, prNumber, modeId } = params;

  const response = await fetch(`${API_BASE}/review/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      owner: owner.trim(),
      repo: repo.trim(),
      pr_number: prNumber,
      mode_id: modeId ?? null,
    }),
  });

  // 处理网络层或 HTTP 层错误
  if (!response.ok) {
    let errorMsg = `请求失败 (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.detail === 'string') {
        errorMsg = errorBody.detail;
      } else if (typeof errorBody?.error === 'string') {
        errorMsg = errorBody.error;
      }
    } catch {
      // 无法解析 JSON 时使用默认错误消息
    }
    return {
      success: false,
      error: errorMsg,
    };
  }

  const data: AnalyzeResponse = await response.json();
  return {
    success: true,
    data,
  };
}

/**
 * 获取历史记录列表
 * @param limit - 返回条数上限，默认 20
 * @returns 历史记录列表
 */
export async function fetchHistory(limit = 20): Promise<HistoryItem[]> {
  const response = await fetch(`${API_BASE}/review/history?limit=${limit}`);

  if (!response.ok) {
    throw new Error(`获取历史记录失败 (HTTP ${response.status})`);
  }

  return response.json();
}

/**
 * 获取历史记录详情
 * @param id - 历史记录 ID
 * @returns 完整历史记录详情（含分析结果）
 */
export async function fetchHistoryDetail(id: number): Promise<HistoryDetail> {
  const response = await fetch(`${API_BASE}/review/history/${id}`);

  if (!response.ok) {
    throw new Error(`获取历史记录详情失败 (HTTP ${response.status})`);
  }

  return response.json();
}

export async function analyzeBatch(prs: BatchAnalyzeItem[]): Promise<BatchAnalyzeResponse> {
  const response = await fetch(`${API_BASE}/review/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prs }),
  });
  if (!response.ok) throw new Error(`批量分析失败 (HTTP ${response.status})`);
  return response.json();
}

export async function fetchModes(): Promise<ReviewMode[]> {
  const response = await fetch(`${API_BASE}/review/modes`);
  if (!response.ok) {
    throw new Error(`获取评审模式失败 (HTTP ${response.status})`);
  }
  return response.json();
}

export async function createMode(data: {
  name: string;
  description: string;
  system_prompt: string;
  temperature?: number;
}): Promise<ReviewMode> {
  const response = await fetch(`${API_BASE}/review/modes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let errorMsg = `创建模式失败 (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.detail === 'string') {
        errorMsg = errorBody.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export async function updateMode(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    system_prompt: string;
    temperature: number;
    sort_order: number;
  }>,
): Promise<ReviewMode> {
  const response = await fetch(`${API_BASE}/review/modes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let errorMsg = `更新模式失败 (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.detail === 'string') {
        errorMsg = errorBody.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export async function deleteMode(id: number): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/review/modes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    let errorMsg = `删除模式失败 (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.detail === 'string') {
        errorMsg = errorBody.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }
  return response.json();
}
