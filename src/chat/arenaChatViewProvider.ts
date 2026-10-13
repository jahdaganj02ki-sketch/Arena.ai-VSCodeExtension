import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ArenaClient } from '../api/arenaClient';
import { ArenaAuthenticationProvider } from '../auth/arenaAuth';
import { ChatMessage } from '../types/arenaTypes';

export const ARENA_AGENT_URL = 'https://arena.ai/agent';
export const ARENA_CHAT_VIEW_ID = 'arena-ai.chatView';

/**
 * Sidebar chat view hosted in the Arena AI activity bar container.
 * Embeds https://arena.ai/agent and offers a native fallback that talks
 * to the extension's Arena API client and the @arena chat participant.
 */
export class ArenaChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = ARENA_CHAT_VIEW_ID;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly arenaClient: ArenaClient,
    private readonly authProvider?: ArenaAuthenticationProvider
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message, webviewView);
    });
  }

  private async handleMessage(message: unknown, webviewView: vscode.WebviewView): Promise<void> {
    if (!message || typeof message !== 'object') {
      return;
    }
    const payload = message as { command?: unknown; text?: unknown };

    if (payload.command === 'openAgent') {
      await vscode.env.openExternal(vscode.Uri.parse(ARENA_AGENT_URL));
      return;
    }

    if (payload.command === 'openVscodeChat') {
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      const query = text.length > 0 ? `@arena ${text}` : '@arena';
      await vscode.commands.executeCommand('workbench.action.chat.open', { query });
      return;
    }

    if (payload.command === 'ask') {
      if (typeof payload.text !== 'string' || payload.text.trim().length === 0) {
        return;
      }
      try {
        const answer = await this.askArena(payload.text.trim());
        await webviewView.webview.postMessage({ command: 'answer', text: answer });
      } catch (error) {
        Logger.error('Sidebar chat request failed', error);
        await webviewView.webview.postMessage({
          command: 'answer',
          text: '❌ Arena AI ist gerade nicht erreichbar. Bitte erneut versuchen.',
        });
      }
    }
  }

  private async askArena(prompt: string): Promise<string> {
    if (this.authProvider) {
      const sessions = await this.authProvider.getSessions(undefined, {});
      if (sessions.length === 0) {
        return '⚠️ Bitte zuerst anmelden (Command Palette → Arena AI: Authenticate).';
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are Arena AI, an expert coding assistant integrated with VS Code.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      messages.push({
        role: 'system',
        content: `Active file context: ${activeEditor.document.uri.fsPath}`,
      });
    }

    const response = await this.arenaClient.chat({ messages, model: 'arena-1' });
    if (!response.success || !response.data) {
      return `❌ Fehler: ${response.error?.message ?? 'Keine Antwort von Arena AI'}`;
    }
    return response.data.response || response.data.message?.content || 'Keine Antwort erhalten.';
  }

  private getHtml(webview: vscode.Webview): string {
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'arena-icon.svg')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
      webview.cspSource
    } https: data:; style-src ${
      webview.cspSource
    } 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src https://arena.ai https:; connect-src https:;" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; }
  .header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .header img { width: 32px; height: 32px; }
  .header h1 { font-size: 15px; margin: 0; }
  .header p { font-size: 12px; margin: 2px 0 0; opacity: 0.75; }
  .row { display: flex; gap: 8px; margin-bottom: 12px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 10px; cursor: pointer; border-radius: 4px; font-size: 12px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  iframe { width: 100%; height: 420px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editor-background); }
  .hint { font-size: 11px; opacity: 0.75; margin: 6px 0 14px; }
  hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 14px 0; }
  textarea { width: 100%; box-sizing: border-box; min-height: 64px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 8px; font-family: inherit; resize: vertical; }
  #answer { white-space: pre-wrap; font-size: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 8px; margin-top: 8px; min-height: 40px; }
</style>
</head>
<body>
  <div class="header">
    <img src="${logoUri}" alt="Arena AI Logo" />
    <div>
      <h1>Arena AI Agent</h1>
      <p>arena.ai/agent</p>
    </div>
  </div>
  <div class="row">
    <button id="openAgent">Im Browser öffnen</button>
    <button id="openChat" class="secondary">@arena Chat öffnen</button>
  </div>
  <iframe id="agentFrame" src="${ARENA_AGENT_URL}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" title="Arena AI Agent" loading="lazy"></iframe>
  <p class="hint">Falls die Seite nicht eingebettet werden kann (Blockierung durch arena.ai), nutze den Button oben.</p>
  <hr />
  <label for="prompt"><strong>Direkt fragen</strong></label>
  <textarea id="prompt" placeholder="Frage an Arena AI …"></textarea>
  <div class="row" style="margin-top: 8px;">
    <button id="ask">Senden</button>
    <button id="toChat" class="secondary">An @arena übergeben</button>
  </div>
  <div id="answer">Antworten erscheinen hier.</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const promptEl = document.getElementById('prompt');
    const answerEl = document.getElementById('answer');
    document.getElementById('openAgent').addEventListener('click', () => {
      vscode.postMessage({ command: 'openAgent' });
    });
    document.getElementById('openChat').addEventListener('click', () => {
      vscode.postMessage({ command: 'openVscodeChat', text: promptEl.value });
    });
    document.getElementById('ask').addEventListener('click', () => {
      answerEl.textContent = 'Denke nach …';
      vscode.postMessage({ command: 'ask', text: promptEl.value });
    });
    document.getElementById('toChat').addEventListener('click', () => {
      vscode.postMessage({ command: 'openVscodeChat', text: promptEl.value });
    });
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message && message.command === 'answer') {
        answerEl.textContent = message.text;
      }
    });
    // Fallback: wenn arena.ai das Framing blockiert, zeige eine Fehlermeldung
    const frame = document.getElementById('agentFrame');
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; });
    setTimeout(() => {
      if (!loaded) {
        frame.style.display = 'none';
        const msg = document.createElement('p');
        msg.style.fontSize = '12px';
        msg.style.opacity = '0.85';
        msg.textContent = '⚠️ arena.ai kann hier nicht direkt eingebettet werden. Nutze den Button „Im Browser öffnen“ oben, um den Agenten zu laden.';
        frame.parentNode.insertBefore(msg, frame.nextSibling);
      }
    }, 6000);
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function registerArenaChatView(
  context: vscode.ExtensionContext,
  arenaClient: ArenaClient,
  authProvider?: ArenaAuthenticationProvider
): ArenaChatViewProvider {
  const provider = new ArenaChatViewProvider(context.extensionUri, arenaClient, authProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ArenaChatViewProvider.viewId, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  return provider;
}
