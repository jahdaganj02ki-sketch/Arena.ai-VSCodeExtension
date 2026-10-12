import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ArenaClient } from '../api/arenaClient';
import { ArenaAuthenticationProvider } from '../auth/arenaAuth';
import { ChatMessage } from '../types/arenaTypes';

export class ArenaLanguageModelProvider implements vscode.LanguageModelChatProvider {
  private arenaClient: ArenaClient;
  private authProvider?: ArenaAuthenticationProvider;

  constructor(
    private readonly context: vscode.ExtensionContext,
    arenaClient: ArenaClient,
    authProvider?: ArenaAuthenticationProvider
  ) {
    this.arenaClient = arenaClient;
    this.authProvider = authProvider;
  }

  async provideLanguageModelChatResponse(
    messages: vscode.LanguageModelChatMessage[],
    options: vscode.LanguageModelChatRequestOptions,
    progress: vscode.Progress<vscode.LanguageModelChatResponseFragment>,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      Logger.info('Language model chat request started');

      const session = await this.getAuthenticatedSession();
      if (!session) {
        throw new Error('Authentication required. Please authenticate with Arena AI first.');
      }

      const chatMessages: ChatMessage[] = messages.map((msg) => ({
        role: msg.role === vscode.LanguageModelChatRole.User ? 'user' : 'assistant',
        content: typeof msg.content === 'string' ? msg.content : msg.content.map((part) => part.text).join(''),
      }));

      const modelId = options.model?.id || 'arena-1';
      const chatRequest = {
        messages: chatMessages,
        model: modelId,
      };

      const response = await this.arenaClient.chat(chatRequest, token);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to get response from Arena AI');
      }

      const { message } = response.data;
      progress.report({ content: message.content });

      Logger.info('Language model chat request completed');
    } catch (error) {
      Logger.error('Language model chat failed', error);
      throw error;
    }
  }

  async provideLanguageModelChatInfo(
    _options: vscode.LanguageModelChatRequestOptions,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation> {
    return {
      id: 'arena-1',
      name: 'Arena AI Model',
      vendor: 'arena.ai',
      description: 'Arena AI language model for VS Code',
      capabilities: {
        supportsFunctionCalling: true,
        supportsStructuredOutput: true,
        supportsVision: true,
        maxContextTokens: 128000,
      },
    };
  }

  private async getAuthenticatedSession(): Promise<vscode.AuthenticationSession | null> {
    if (!this.authProvider) {
      Logger.warn('No authentication provider available');
      return null;
    }

    const sessions = await this.authProvider.getSessions();
    if (sessions.length === 0) {
      Logger.warn('No authenticated sessions found');
      return null;
    }

    return sessions[0];
  }

  dispose(): void {
    // Cleanup if needed
  }
}

export function registerArenaLanguageModelProvider(
  context: vscode.ExtensionContext,
  arenaClient: ArenaClient,
  authProvider?: ArenaAuthenticationProvider
): ArenaLanguageModelProvider {
  const provider = new ArenaLanguageModelProvider(context, arenaClient, authProvider);

  return vscode.lm.registerLanguageModelChatProvider('arena-ai', provider);
}