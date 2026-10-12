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
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      Logger.info('Language model chat request started');

      const session = await this.getAuthenticatedSession();
      if (!session) {
        throw new Error('Authentication required. Please authenticate with Arena AI first.');
      }

      const chatMessages: ChatMessage[] = messages.map((msg) => ({
        role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
        content: msg.content
          .map((part) => {
            if (part instanceof vscode.LanguageModelTextPart) {
              return part.value;
            }
            return '';
          })
          .join(''),
      }));

      const modelId = model.id || 'arena-1';
      const chatRequest = {
        messages: chatMessages,
        model: modelId,
      };

      const response = await this.arenaClient.chat(chatRequest as any, token as any);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to get response from Arena AI');
      }

      const text = response.data.response || response.data.message?.content || 'No output';
      const part = new vscode.LanguageModelTextPart(text);
      progress.report(part);

      Logger.info('Language model chat request completed');
    } catch (error) {
      Logger.error('Language model chat failed', error);
      throw error;
    }
  }

  async provideLanguageModelChatInformation(
    _options: vscode.PrepareLanguageModelChatModelOptions,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {
    return [{
      id: 'arena-1',
      name: 'Arena AI Model',
      family: 'arena-ai',
      version: '1.0',
      maxInputTokens: 128000,
      maxOutputTokens: 4096,
      capabilities: {
        toolCalling: true,
        imageInput: true,
      },
    }];
  }

  async provideTokenCount(
    _model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    _token: vscode.CancellationToken
  ): Promise<number> {
    const value = typeof text === 'string' ? text : text.content
      .map((part) => (part instanceof vscode.LanguageModelTextPart ? part.value : ''))
      .join('');
    return value.length;
  }

  private async getAuthenticatedSession(): Promise<vscode.AuthenticationSession | null> {
    if (!this.authProvider) {
      Logger.warn('No authentication provider available');
      return null;
    }

    const sessions = await this.authProvider.getSessions(undefined, {});
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
): vscode.Disposable {
  const provider = new ArenaLanguageModelProvider(context, arenaClient, authProvider);

  return vscode.lm.registerLanguageModelChatProvider('arena-ai', provider);
}