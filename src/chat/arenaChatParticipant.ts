import * as vscode from 'vscode';
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

    this.chatProvider = vscode.chat.createChatParticipant('arena', this.handleChatRequest.bind(this));
    this.chatProvider.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      'resources',
      'arena-icon.svg'
    );

    context.subscriptions.push(this.chatProvider);
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

  private async gatherWorkspaceContext(): Promise<WorkspaceContext> {
    const context: WorkspaceContext = {
      files: [],
    };

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      context.activeFile = {
        path: activeEditor.document.uri.fsPath,
        content: activeEditor.document.getText(),
        selection: {
          startLine: activeEditor.selection.start.line,
          endLine: activeEditor.selection.end.line,
          startColumn: activeEditor.selection.start.character,
          endColumn: activeEditor.selection.end.character,
        },
      };
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

      if (workspaceContext.activeFile) {
        messages.push({
          role: 'system',
          content: `Active file context: ${workspaceContext.activeFile.path}`,
        });
      }

      const modelId = request.model?.id ?? 'arena-1';
      const chatRequest = {
        messages,
        model: modelId,
        workspaceContext,
        command: request.command,
      };

      const response = await this.arenaClient.chat(chatRequest, token);

      if (!response.success || !response.data) {
        stream.markdown(`❌ Error: ${response.error?.message || 'Failed to get response from Arena AI'}`);
        return { metadata: { command: request.command } };
      }

      const text = response.data.response || response.data.message?.content || 'No output';
      stream.markdown(text);

      const files = response.data.files || response.data.message?.files || [];
      if (files.length > 0) {
        stream.markdown('\n\n### Generated Files\n');
        for (const file of files) {
          stream.markdown(`- \`${file.path}\`\n`);
        }
      }

      return {
        metadata: {
          command: request.command,
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