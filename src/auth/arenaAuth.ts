import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { ArenaClient } from '../api/arenaClient';
import { ArenaSession, ARENA_API_DEFAULTS } from '../types/arenaTypes';

export class ArenaAuthenticationProvider implements vscode.AuthenticationProvider {
  private _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  private sessions: Map<string, ArenaSession> = new Map();
  private readonly arenaClient: ArenaClient;

  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly clientId: string,
    private readonly clientSecret: string | undefined,
    private readonly client: ArenaClient
  ) {
    this.arenaClient = client;
    this.loadExistingSessions();
  }

  private async loadExistingSessions(): Promise<void> {
    try {
      const storedSessions = await this.extensionContext.secrets.get('arena.ai.sessions');
      if (storedSessions) {
        const sessions: ArenaSession[] = JSON.parse(storedSessions);
        sessions.forEach((session) => {
          this.sessions.set(session.account.id, session);
        });
        Logger.info(`Loaded ${sessions.length} existing session(s)`);
      }
    } catch (error) {
      Logger.error('Failed to load existing sessions', error);
    }
  }

  private async saveSessions(): Promise<void> {
    try {
      const sessions = Array.from(this.sessions.values());
      await this.extensionContext.secrets.store(
        'arena.ai.sessions',
        JSON.stringify(sessions)
      );
    } catch (error) {
      Logger.error('Failed to save sessions', error);
    }
  }

  async getSessions(
    _scopes: readonly string[] | undefined,
    _options: vscode.AuthenticationProviderSessionOptions
  ): Promise<vscode.AuthenticationSession[]> {
    return Array.from(this.sessions.values()).map((session) => ({
      accessToken: session.accessToken,
      account: session.account,
      scopes: session.scopes,
      id: session.id,
    }));
  }

  async createSession(
    scopes: readonly string[],
    _options: vscode.AuthenticationProviderSessionOptions
  ): Promise<vscode.AuthenticationSession> {
    return new Promise((resolve, reject) => {
      const state = uuidv4();
      const redirectUri = `${vscode.env.uriScheme}://arena-ai.vscode-extension/auth-callback`;
      const authUrl = `${ARENA_API_DEFAULTS.BASE_URL}${ARENA_API_DEFAULTS.OAUTH_AUTH_PATH}?${new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state,
      }).toString()}`;

      Logger.info('Opening browser for arena.ai authentication');

      vscode.window.showInformationMessage(
        'Opening browser to authenticate with arena.ai...',
        'Open Browser',
        'Cancel'
      ).then((selection) => {
        if (selection === 'Cancel') {
          reject(new Error('Authentication cancelled by user'));
          return;
        }

        if (selection === 'Open Browser' || selection === undefined) {
          vscode.env.openExternal(vscode.Uri.parse(authUrl)).then(
            (opened) => {
              if (opened) {
                Logger.info('Browser opened for authentication');
              } else {
                Logger.warn('Browser open was not accepted');
              }
            },
            (error) => {
              Logger.error('Failed to open browser', error);
              vscode.window.showErrorMessage(
                'Failed to open browser. Please open the following URL manually:\n' + authUrl
              );
            }
          );
        }
      });

      const checkForCallback = setInterval(async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'vscode-auth') {
          const url = activeEditor.document.uri.toString();
          clearInterval(checkForCallback);

          try {
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get('code');
            const returnedState = urlObj.searchParams.get('state');

            if (!code) {
              throw new Error('No authorization code returned');
            }

            if (returnedState !== state) {
              throw new Error('State mismatch - possible CSRF attack');
            }

            const tokenResponse = await this.arenaClient.exchangeCodeForToken(
              this.clientId,
              this.clientSecret,
              code,
              redirectUri
            );

            if (!tokenResponse.success || !tokenResponse.data) {
              throw new Error(tokenResponse.error?.message || 'Token exchange failed');
            }

            const session: ArenaSession = {
              id: state,
              accessToken: tokenResponse.data.access_token,
              refreshToken: tokenResponse.data.refresh_token,
              expiresAt: tokenResponse.data.expires_in
                ? Date.now() + tokenResponse.data.expires_in * 1000
                : undefined,
              account: {
                label: 'Arena AI User',
                id: state,
              },
              scopes: Array.from(scopes),
            };

            this.sessions.set(session.account.id, session);
            this.arenaClient.setAccessToken(session.accessToken);
            await this.saveSessions();

            this._onDidChangeSessions.fire({
              added: [session],
              removed: [],
              changed: [],
            });

            vscode.window.showInformationMessage('Successfully authenticated with arena.ai');
            resolve({
              accessToken: session.accessToken,
              account: session.account,
              scopes: session.scopes,
              id: session.id,
            });
          } catch (error) {
            Logger.error('Authentication callback error', error);
            reject(error);
          }
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(checkForCallback);
        reject(new Error('Authentication timed out'));
      }, 5 * 60 * 1000);
    });
  }

  async removeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      await this.saveSessions();
      this._onDidChangeSessions.fire({
        added: [],
        removed: [session],
        changed: [],
      });
      Logger.info(`Session removed: ${sessionId}`);
    }
  }

  async dispose(): Promise<void> {
    this._onDidChangeSessions.dispose();
    this.sessions.clear();
  }
}

export function registerArenaAuthenticationProvider(
  context: vscode.ExtensionContext,
  clientId: string,
  clientSecret: string | undefined,
  client: ArenaClient
): ArenaAuthenticationProvider {
  const provider = new ArenaAuthenticationProvider(context, clientId, clientSecret, client);

  vscode.authentication.registerAuthenticationProvider(
    'arena-ai',
    'Arena AI',
    provider,
    { supportsMultipleAccounts: true }
  );

  return provider;
}