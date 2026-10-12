import * as vscode from 'vscode';
import { ArenaFileSync } from '../files/fileSync';
import { FileSyncItem, SyncStatus } from '../types/arenaTypes';

export class ArenaFileExplorerProvider implements vscode.TreeDataProvider<ArenaFileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ArenaFileItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly fileSync: ArenaFileSync) {
    this.fileSync = fileSync;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ArenaFileItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ArenaFileItem): Thenable<ArenaFileItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const pendingSync = this.fileSync.getPendingSync();
    const items = pendingSync.map((item) => new ArenaFileItem(item));

    return Promise.resolve(items);
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

export class ArenaFileItem extends vscode.TreeItem {
  constructor(public readonly syncItem: FileSyncItem) {
    super(syncItem.path, syncItem.type === 'delete' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.None);

    this.tooltip = `${syncItem.path}\nStatus: ${syncItem.status}\nType: ${syncItem.type}`;
    this.description = syncItem.status;
    this.contextValue = `arenaFile-${syncItem.status}`;

    if (syncItem.type === 'delete') {
      this.iconPath = new vscode.ThemeIcon('trash');
      this.description = 'Deleted';
    } else if (syncItem.type === 'create') {
      this.iconPath = new vscode.ThemeIcon('new-file');
      this.description = 'Created';
    } else {
      this.iconPath = new vscode.ThemeIcon('file');
    }

    if (syncItem.status === SyncStatus.SYNCING) {
      this.iconPath = new vscode.ThemeIcon('sync~spin');
      this.description = 'Syncing...';
    } else if (syncItem.status === SyncStatus.ERROR) {
      this.iconPath = new vscode.ThemeIcon('error');
      this.description = 'Error';
    } else if (syncItem.status === SyncStatus.SYNCED) {
      this.iconPath = new vscode.ThemeIcon('check');
      this.description = 'Synced';
    }
  }
}

export function registerArenaFileExplorer(
  context: vscode.ExtensionContext,
  fileSync: ArenaFileSync
): ArenaFileExplorerProvider {
  const provider = new ArenaFileExplorerProvider(fileSync);

  context.subscriptions.push(vscode.window.registerTreeDataProvider('arenaFileExplorer', provider));

  context.subscriptions.push(provider);

  return provider;
}