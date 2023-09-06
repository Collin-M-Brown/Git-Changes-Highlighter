import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export const DEBUG = false;
export function debugLog(message: string) {
    if (DEBUG) {
        console.log(message);
    }
}

export function getWorkspacePath(): string {
    let configuredPath = vscode.workspace.getConfiguration('git-highlighter').get<string>('CommitListPath');
    if (!configuredPath || (configuredPath === "")) {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage(`No workspace folders open, and no path configured`);
            return '';
        }
        configuredPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    console.log(`Workspace path: ${configuredPath}`);
    return configuredPath;
}

export function getCommitList(): string[] {

    let branches = vscode.workspace.getConfiguration('git-highlighter').get<string[]>('HighlightList');
    if (!branches || (branches.length === 0)) {
        let CommitListPath = path.join(getWorkspacePath(), '.vscode/CommitList');
        if (fs.existsSync(CommitListPath)) {
            branches = fs.readFileSync(path.join(getWorkspacePath(), '.vscode/CommitList'), 'utf8').split('\n');
        }
    }
    debugLog(`branches set: ${branches}`);
    if (!branches || (branches.length === 0)) {
        vscode.window.showErrorMessage(`No commits found in CommitList: ${branches}`);
        return [];
    }

    return branches;

}