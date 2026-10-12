export interface ArenaSession {
  id: string;
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
  capabilities?: {
    toolCalling?: boolean;
    imageInput?: boolean;
  };
}

export interface ArenaApiResponse<T = unknown> {
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

export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  ERROR = 'error',
}

export interface FileSyncItem {
  path: string;
  uri?: string;
  type?: 'change' | 'create' | 'delete';
  status?: SyncStatus;
  lastModified?: number;
  content?: string;
  encoding?: 'utf-8' | 'base64';
  action?: 'create' | 'update' | 'delete';
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
  prompt?: string;
  messages?: ChatMessage[];
  model?: string;
  context?: WorkspaceContext;
  workspaceContext?: WorkspaceContext;
  history?: ChatMessage[];
  files?: string[];
  command?: string;
}

export interface ArenaChatResponse {
  response: string;
  message?: {
    content: string;
    files?: FileSyncItem[];
  };
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