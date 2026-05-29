/**
 * @file src/api/review.ts
 * @description AI PR Review API 调用封装
 */

import type { AnalyzeRequest, AnalyzeResponse, AnalyzeResult } from '../types/review';

/** API 基础路径（通过 Vite proxy 转发到后端） */
const API_BASE = '/api';

/**
 * 发起 PR 分析请求
 * @param params - owner、repo、prNumber 参数
 * @returns 分析结果（成功则包含后端数据，失败则包含错误信息）
 */
export async function analyzePR(params: AnalyzeRequest): Promise<AnalyzeResult> {
  const { owner, repo, prNumber } = params;

  const response = await fetch(`${API_BASE}/review/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      owner: owner.trim(),
      repo: repo.trim(),
      pr_number: prNumber,
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
