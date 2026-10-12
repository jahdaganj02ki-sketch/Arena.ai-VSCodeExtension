import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from '../utils/logger';
import {
  ARENA_API_DEFAULTS,
  ArenaApiResponse,
  ArenaChatRequest,
  ArenaChatResponse,
  ArenaModel,
  FileSyncItem,
} from '../types/arenaTypes';

export class ArenaClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string | undefined;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: ARENA_API_DEFAULTS.BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Arena-AI-VSCode-Extension/0.1.0',
      },
    });

    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        Logger.error('API request failed', error);
        return Promise.reject(error);
      }
    );
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  clearAccessToken(): void {
    this.accessToken = undefined;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ArenaApiResponse<T>> {
    try {
      const fullConfig: AxiosRequestConfig = {
        method,
        url: path,
        data,
        ...config,
      };

      const response: AxiosResponse<ArenaApiResponse<T>> =
        await this.axiosInstance.request(fullConfig);

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: {
            message: error.response.data?.error?.message || error.response.statusText,
            code: error.response.data?.error?.code,
          },
        };
      } else if (axios.isAxiosError(error) && error.request) {
        return {
          success: false,
          error: {
            message: 'Network error: Unable to reach arena.ai API',
            code: 'NETWORK_ERROR',
          },
        };
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: {
            message,
            code: 'UNKNOWN_ERROR',
          },
        };
      }
    }
  }

  async getModels(): Promise<ArenaApiResponse<ArenaModel[]>> {
    return this.request<ArenaModel[]>('GET', `${ARENA_API_DEFAULTS.API_PATH}/models`);
  }

  async chat(request: ArenaChatRequest, _token?: unknown): Promise<ArenaApiResponse<ArenaChatResponse>> {
    return this.request<ArenaChatResponse>('POST', `${ARENA_API_DEFAULTS.API_PATH}/chat`, request);
  }

  async uploadFile(filePath: string, fileContent: Uint8Array): Promise<ArenaApiResponse<{ uploaded: boolean }>> {
    return this.request<{ uploaded: boolean }>('POST', `${ARENA_API_DEFAULTS.API_PATH}/files/upload`, {
      filePath,
      content: Array.from(fileContent),
    });
  }

  async deleteFile(filePath: string): Promise<ArenaApiResponse<{ deleted: boolean }>> {
    return this.request<{ deleted: boolean }>('DELETE', `${ARENA_API_DEFAULTS.API_PATH}/files`, {
      filePath,
    });
  }

  async downloadFile(filePath: string): Promise<ArenaApiResponse<Uint8Array>> {
    return this.request<Uint8Array>('POST', `${ARENA_API_DEFAULTS.API_PATH}/files/download`, {
      filePath,
    });
  }

  dispose(): void {
    // No-op for compatibility with extension lifecycle subscriptions.
  }

  async uploadFiles(files: FileSyncItem[]): Promise<ArenaApiResponse<{ uploaded: number }>> {
    return this.request<{ uploaded: number }>('POST', `${ARENA_API_DEFAULTS.API_PATH}/files/upload`, { files });
  }

  async downloadFiles(filePaths: string[]): Promise<ArenaApiResponse<{ files: FileSyncItem[] }>> {
    return this.request<{ files: FileSyncItem[] }>('POST', `${ARENA_API_DEFAULTS.API_PATH}/files/download`, { paths: filePaths });
  }

  async syncFiles(files: FileSyncItem[]): Promise<ArenaApiResponse<{ synced: number }>> {
    return this.request<{ synced: number }>('POST', `${ARENA_API_DEFAULTS.API_PATH}/files/sync`, { files });
  }

  async getAuthUrl(clientId: string, redirectUri: string, state: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: ARENA_API_DEFAULTS.OAUTH_SCOPE,
      state,
    });

    return `${ARENA_API_DEFAULTS.BASE_URL}${ARENA_API_DEFAULTS.OAUTH_AUTH_PATH}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    clientId: string,
    clientSecret: string | undefined,
    code: string,
    redirectUri: string
  ): Promise<ArenaApiResponse<{ access_token: string; refresh_token?: string; expires_in?: number }>> {
    return this.request('POST', ARENA_API_DEFAULTS.OAUTH_TOKEN_PATH, {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
  }

  async refreshToken(
    clientId: string,
    clientSecret: string | undefined,
    refreshToken: string
  ): Promise<ArenaApiResponse<{ access_token: string; refresh_token?: string; expires_in?: number }>> {
    return this.request('POST', ARENA_API_DEFAULTS.OAUTH_TOKEN_PATH, {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });
  }
}