import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { ArenaClient } from './api/arenaClient';
import { registerArenaAuthenticationProvider } from './auth/arenaAuth';
import { registerArenaChatParticipant } from './chat/arenaChatParticipant';
import { ARENA_CHAT_VIEW_ID, registerArenaChatView } from './chat/arenaChatViewProvider';
import { registerArenaLanguageModelProvider } from './model/arenaModelProvider';
import { registerArenaFileSync } from './files/fileSync';
import { registerArenaFileExplorer } from './tree/fileExplorerProvider';

export function activate(context: vscode.ExtensionContext): void {
  Logger.info('Arena AI extension is now active');

  const clientId = process.env.ARENA_CLIENT_ID || 'arena-ai-vscode-extension';
  const clientSecret = process.env.ARENA_CLIENT_SECRET;

  const arenaClient = new ArenaClient();

  const authProvider = registerArenaAuthenticationProvider(
    context,
    clientId,
    clientSecret,
    arenaClient
  );

  registerArenaChatParticipant(context, arenaClient, authProvider);

  registerArenaChatView(context, arenaClient, authProvider);

  const openChatViewCommand = vscode.commands.registerCommand('arena-ai.openChatView', async () => {
    await vscode.commands.executeCommand(`${ARENA_CHAT_VIEW_ID}.focus`);
  });

  const openAgentInBrowserCommand = vscode.commands.registerCommand(
    'arena-ai.openAgentInBrowser',
    async () => {
      await vscode.env.openExternal(vscode.Uri.parse('https://arena.ai/agent'));
    }
  );

  registerArenaLanguageModelProvider(context, arenaClient, authProvider);

  const fileSync = registerArenaFileSync(context, arenaClient, authProvider);

  const fileExplorer = registerArenaFileExplorer(context, fileSync);

  const authenticateCommand = vscode.commands.registerCommand('arena-ai.authenticate', async () => {
    try {
      const sessions = await authProvider.getSessions(undefined, {});
      if (sessions.length > 0) {
        vscode.window.showInformationMessage('Already authenticated with Arena AI');
        return;
      }

      await authProvider.createSession(['read', 'write'], {});
      vscode.window.showInformationMessage('Successfully authenticated with Arena AI');
    } catch (error) {
      Logger.error('Authentication failed', error);
      vscode.window.showErrorMessage('Failed to authenticate with Arena AI');
    }
  });

  const signOutCommand = vscode.commands.registerCommand('arena-ai.signOut', async () => {
    try {
      const sessions = await authProvider.getSessions(undefined, {});
      for (const session of sessions) {
        await authProvider.removeSession(session.account.id);
      }
      vscode.window.showInformationMessage('Signed out of Arena AI');
    } catch (error) {
      Logger.error('Sign out failed', error);
      vscode.window.showErrorMessage('Failed to sign out');
    }
  });

  const syncCommand = vscode.commands.registerCommand('arena-ai.sync', async () => {
    try {
      await fileSync.syncAll();
      fileExplorer.refresh();
      vscode.window.showInformationMessage('Arena AI sync completed');
    } catch (error) {
      Logger.error('Sync failed', error);
      vscode.window.showErrorMessage('Arena AI sync failed');
    }
  });

  const refreshCommand = vscode.commands.registerCommand('arena-ai.refresh', () => {
    fileExplorer.refresh();
  });

  context.subscriptions.push(
    authenticateCommand,
    signOutCommand,
    syncCommand,
    refreshCommand,
    openChatViewCommand,
    openAgentInBrowserCommand,
    arenaClient,
    fileSync,
    fileExplorer
  );

  fileSync.startAutoSync();
}

export function deactivate(): void {
  Logger.info('Arena AI extension is being deactivated');
}