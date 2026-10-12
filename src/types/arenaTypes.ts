import * as vscode from 'vscode';

export interface ArenaSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  account: {
    label: string;
    id: string;
  };
  scopes: string[];
}

export interface ArenaModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  maxOutputTokens?: number;
}

export interface ArenaApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  files?: string[];
}

export interface FileSyncItem {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  lastModified?: number;
  action: 'create' | 'update' | 'delete';
}

export interface WorkspaceContext {
  files: {
    path: string;
    content: string;
    language?: string;
  }[];
  activeFile?: {
    path: string;
    content: string;
    selection?: {
      startLine: number;
      endLine: number;
      startColumn: number;
      endColumn: number;
    };
  };
  workspaceFolder?: string;
}

export interface ArenaChatRequest {
  prompt: string;
  model?: string;
  context?: WorkspaceContext;
  history?: ChatMessage[];
  files?: string[];
}

export interface ArenaChatResponse {
  response: string;
  files?: FileSyncItem[];
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SyncResult {
  success: boolean;
  syncedFiles: number;
  errors: string[];
  updatedFiles?: string[];
}

export const ARENA_API_DEFAULTS = {
  BASE_URL: 'https://arena.ai',
  API_PATH: '/api/v1',
  OAUTH_AUTH_PATH: '/oauth/authorize',
  OAUTH_TOKEN_PATH: '/oauth/token',
  OAUTH_SCOPE: 'offline_access chat files workspace',
};

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/out/**',
  '**/*.bin',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.png',
  '**/*.gif',
  '**/*.pdf',
  '**/*.zip',
];

export const MAX_SYNC_FILE_SIZE = 1024 * 1024; // 1MB