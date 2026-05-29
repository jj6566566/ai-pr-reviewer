export interface User {
  id: number;
  github_id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export interface Repo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  private: boolean;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  html_url: string;
}
