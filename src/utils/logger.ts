import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.OutputChannel | undefined;

  private static getChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Arena AI Agent');
    }
    return this.outputChannel;
  }

  static info(message: string, ...args: unknown[]): void {
    this.log('INFO', message, args);
  }

  static warn(message: string, ...args: unknown[]): void {
    this.log('WARN', message, args);
  }

  static error(message: string, error?: unknown): void {
    const errorMessage = error instanceof Error
      ? error.message
      : error
        ? String(error)
        : '';
    this.log('ERROR', errorMessage ? `${message}: ${errorMessage}` : message, []);
  }

  static debug(message: string, ...args: unknown[]): void {
    this.log('DEBUG', message, args);
  }

  private static log(level: string, message: string, args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    const logMessage = `[${timestamp}] [${level}] ${message}${formattedArgs}`;
    this.getChannel().appendLine(logMessage);

    if (level === 'ERROR') {
      console.error(logMessage);
    } else if (level === 'WARN') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  }

  static show(): void {
    this.getChannel().show();
  }

  static dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
      this.outputChannel = undefined;
    }
  }
}