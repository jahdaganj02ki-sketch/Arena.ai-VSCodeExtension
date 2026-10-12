import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ArenaClient } from '../api/arenaClient';
import { ArenaAuthenticationProvider } from '../auth/arenaAuth';
import { FileSyncItem, SyncStatus } from '../types/arenaTypes';

export class ArenaFileSync {
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private syncInterval: NodeJS.Timeout | undefined;
  private pendingSync: Map<string, FileSyncItem> = new Map();
  private arenaClient: ArenaClient;
  private authProvider?: ArenaAuthenticationProvider;
  private isSyncing: boolean = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    arenaClient: ArenaClient,
    authProvider?: ArenaAuthenticationProvider
  ) {
    this.arenaClient = arenaClient;
    this.authProvider = authProvider;
    this.setupFileWatcher();
    this.loadPendingSync();
  }

  private setupFileWatcher(): void {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, true);

    this.fileWatcher.onDidChange((uri) => this.handleFileChange(uri, 'change'));
    this.fileWatcher.onDidCreate((uri) => this.handleFileChange(uri, 'create'));
    this.fileWatcher.onDidDelete((uri) => this.handleFileChange(uri, 'delete'));

    this.context.subscriptions.push(this.fileWatcher);
    Logger.info('File watcher setup complete');
  }

  private async handleFileChange(uri: vscode.Uri, type: 'change' | 'create' | 'delete'): Promise<void> {
    if (uri.scheme !== 'file') {
      return;
    }

    const relativePath = vscode.workspace.asRelativePath(uri);
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('.git')) {
      return;
    }

    const fileItem: FileSyncItem = {
      path: relativePath,
      uri: uri.toString(),
      type,
      status: SyncStatus.PENDING,
      lastModified: Date.now(),
    };

    this.pendingSync.set(relativePath, fileItem);
    await this.savePendingSync();
    Logger.debug(`File change detected: ${relativePath} (${type})`);
  }

  private async loadPendingSync(): Promise<void> {
    try {
      const stored = await this.context.workspaceState.get('arena.ai.pendingSync');
      if (stored) {
        const items: FileSyncItem[] = JSON.parse(stored);
        items.forEach((item) => {
          this.pendingSync.set(item.path, item);
        });
        Logger.info(`Loaded ${items.length} pending sync item(s)`);
      }
    } catch (error) {
      Logger.error('Failed to load pending sync', error);
    }
  }

  private async savePendingSync(): Promise<void> {
    try {
      const items = Array.from(this.pendingSync.values());
      await this.context.workspaceState.store('arena.ai.pendingSync', JSON.stringify(items));
    } catch (error) {
      Logger.error('Failed to save pending sync', error);
    }
  }

  public async syncAll(): Promise<void> {
    if (this.isSyncing) {
      Logger.warn('Sync already in progress');
      return;
    }

    const session = await this.getAuthenticatedSession();
    if (!session) {
      Logger.warn('No authenticated session for sync');
      return;
    }

    this.isSyncing = true;
    try {
      const items = Array.from(this.pendingSync.values());
      if (items.length === 0) {
        Logger.info('No files to sync');
        return;
      }

      Logger.info(`Starting sync of ${items.length} file(s)`);

      for (const item of items) {
        try {
          item.status = SyncStatus.SYNCING;

          if (item.type === 'delete') {
            await this.arenaClient.deleteFile(item.path);
          } else {
            const fileUri = vscode.Uri.file(item.path);
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            await this.arenaClient.uploadFile(item.path, fileContent);
          }

          item.status = SyncStatus.SYNCED;
          this.pendingSync.delete(item.path);
        } catch (error) {
          Logger.error(`Failed to sync file: ${item.path}`, error);
          item.status = SyncStatus.ERROR;
        }
      }

      await this.savePendingSync();
      Logger.info('Sync completed');
    } finally {
      this.isSyncing = false;
    }
  }

  public async syncFile(filePath: string): Promise<void> {
    const session = await this.getAuthenticatedSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    try {
      const fileUri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      await this.arenaClient.uploadFile(filePath, fileContent);
      Logger.info(`File synced: ${filePath}`);
    } catch (error) {
      Logger.error(`Failed to sync file: ${filePath}`, error);
      throw error;
    }
  }

  public async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const session = await this.getAuthenticatedSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    try {
      const response = await this.arenaClient.downloadFile(remotePath);
      if (response.success && response.data) {
        const fileUri = vscode.Uri.file(localPath);
        await vscode.workspace.fs.writeFile(fileUri, response.data);
        Logger.info(`File downloaded: ${remotePath} -> ${localPath}`);
      } else {
        throw new Error(response.error?.message || 'Download failed');
      }
    } catch (error) {
      Logger.error(`Failed to download file: ${remotePath}`, error);
      throw error;
    }
  }

  public startAutoSync(): void {
    if (this.syncInterval) {
      return;
    }

    this.syncInterval = setInterval(() => {
      this.syncAll().catch((error) => {
        Logger.error('Auto-sync failed', error);
      });
    }, 5 * 60 * 1000); // Sync every 5 minutes

    Logger.info('Auto-sync started');
  }

  public stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      Logger.info('Auto-sync stopped');
    }
  }

  private async getAuthenticatedSession(): Promise<vscode.AuthenticationSession | null> {
    if (!this.authProvider) {
      return null;
    }

    const sessions = await this.authProvider.getSessions();
    return sessions.length > 0 ? sessions[0] : null;
  }

  public getPendingSync(): FileSyncItem[] {
    return Array.from(this.pendingSync.values());
  }

  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export function registerArenaFileSync(
  context: vscode.ExtensionContext,
  arenaClient: ArenaClient,
  authProvider?: ArenaAuthenticationProvider
): ArenaFileSync {
  return new ArenaFileSync(context, arenaClient, authProvider);
}