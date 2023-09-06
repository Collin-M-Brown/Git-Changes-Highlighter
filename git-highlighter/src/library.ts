import * as vscode from 'vscode';

export const DEBUG = true;
export function debugLog(message: string) {
    if (DEBUG) {
        console.log(message);
    }
}

export function getWorkspacePath(): string {
    if (!vscode.workspace.workspaceFolders) {
        console.error('No workspace folders open');
        return '';
    }
    console.log(`Workspace path: ${vscode.workspace.workspaceFolders[0].uri.fsPath}`);
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}
