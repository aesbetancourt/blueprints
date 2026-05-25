import { invoke } from '@tauri-apps/api/core';

export interface GitFileStatus {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed' | 'typechange';
  staged: boolean;
}

export interface GitLogEntry {
  id: string;
  message: string;
  author: string;
  date: number;
}

export interface GitBranchInfo {
  current: string;
  branches: string[];
}

export const GitService = {
  async status(): Promise<GitFileStatus[]> {
    return invoke<GitFileStatus[]>('git_status');
  },

  async diff(filePath: string, staged: boolean): Promise<string> {
    return invoke<string>('git_diff', { filePath, staged });
  },

  async stage(filePath: string): Promise<undefined> {
    return invoke<undefined>('git_stage', { filePath });
  },

  async unstage(filePath: string): Promise<undefined> {
    return invoke<undefined>('git_unstage', { filePath });
  },

  async stageAll(): Promise<undefined> {
    return invoke<undefined>('git_stage_all');
  },

  async unstageAll(): Promise<undefined> {
    return invoke<undefined>('git_unstage_all');
  },

  async commit(message: string): Promise<string> {
    return invoke<string>('git_commit', { message });
  },

  async discard(filePath: string): Promise<undefined> {
    return invoke<undefined>('git_discard', { filePath });
  },

  async log(limit?: number): Promise<GitLogEntry[]> {
    return invoke<GitLogEntry[]>('git_log', { limit: limit ?? null });
  },

  async branches(): Promise<GitBranchInfo> {
    return invoke<GitBranchInfo>('git_branches');
  },
};
