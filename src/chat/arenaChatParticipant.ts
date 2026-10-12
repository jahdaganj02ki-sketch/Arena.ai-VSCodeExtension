import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { ArenaClient } from '../api/arenaClient';
import { ArenaAuthenticationProvider } from '../auth/arenaAuth';
import { ChatMessage, WorkspaceContext } from '../types/arenaTypes';

export class ArenaChatParticipant {
  private chatProvider: vscode.ChatParticipant;
  private arenaClient: ArenaClient;
  private authProvider: ArenaAuthenticationProvider | undefined;

  constructor(
    context: vscode.ExtensionContext,
    arenaClient: ArenaClient,
    authProvider?: ArenaAuthenticationProvider
  ) {
    this.arenaClient = arenaClient;
    this.authProvider = authProvider;

    this.chatProvider = vscode.chat.createChatParticipant(
      {
        id: 'arena',
        name: 'Arena AI',
        description: 'Arena AI agent for VS Code',
        icon: vscode.Uri.parse('https://arena.ai/favicon.ico'),
        isTrusted: true,
        settings: {
          models: ['arena-1', 'arena-2'],
          defaultModel: 'arena-1',
        },
      },
      this.handleChatRequest.bind(this)
    );

    context.subscriptions.push(this.chatProvider);
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

  private async gatherWorkspaceContext(): Promise<WorkspaceContext> {
    const context: WorkspaceContext = {
      files: [],
      activeEditor: undefined,
      selection: undefined,
    };

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      context.activeEditor = {
        uri: activeEditor.document.uri.toString(),
        language: activeEditor.document.languageId,
        content: activeEditor.document.getText(),
      };

      if (!activeEditor.selection.isEmpty) {
        context.selection = {
          text: activeEditor.document.getText(activeEditor.selection),
          range: {
            start: {
              line: activeEditor.selection.start.line,
              character: activeEditor.selection.start.character,
            },
            end: {
              line: activeEditor.selection.end.line,
              character: activeEditor.selection.end.character,
            },
          },
        };
      }
    }

    return context;
  }

  private async handleChatRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    try {
      Logger.info(`Chat request: ${request.command || 'chat'} - ${request.prompt.substring(0, 100)}...`);

      const session = await this.getAuthenticatedSession();
      if (!session) {
        stream.markdown('⚠️ Please authenticate with Arena AI first. Use the command palette to authenticate.');
        return { metadata: { command: request.command } };
      }

      const workspaceContext = await this.gatherWorkspaceContext();
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are Arena AI, an expert coding assistant integrated with VS Code.',
        },
        {
          role: 'user',
          content: request.prompt,
        },
      ];

      if (workspaceContext.activeEditor) {
        messages.push({
          role: 'system',
          content: `Active file context: ${workspaceContext.activeEditor.language} file at ${workspaceContext.activeEditor.uri}`,
        });
      }

      const chatRequest = {
        messages,
        model: request.model?.id || 'arena-1',
        workspaceContext,
        command: request.command,
      };

      const response = await this.arenaClient.chat(chatRequest, token);

      if (!response.success || !response.data) {
        stream.markdown(`❌ Error: ${response.error?.message || 'Failed to get response from Arena AI'}`);
        return { metadata: { command: request.command } };
      }

      const { message } = response.data;
      stream.markdown(message.content);

      if (message.files && message.files.length > 0) {
        stream.markdown('\n\n### Generated Files\n');
        for (const file of message.files) {
          stream.markdown(`- \`${file.path}\`\n`);
        }
      }

      return {
        metadata: {
          command: request.command,
          parentMessageId: request.parentMessageId,
        },
      };
    } catch (error) {
      Logger.error('Chat request failed', error);
      stream.markdown('❌ An unexpected error occurred. Please try again.');
      return { metadata: { command: request.command } };
    }
  }

  public getParticipant(): vscode.ChatParticipant {
    return this.chatProvider;
  }
}

export function registerArenaChatParticipant(
  context: vscode.ExtensionContext,
  arenaClient: ArenaClient,
  authProvider?: ArenaAuthenticationProvider
): ArenaChatParticipant {
  return new ArenaChatParticipant(context, arenaClient, authProvider);
}