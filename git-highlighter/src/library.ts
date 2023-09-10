import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export const DEBUG = true;
export function debugLog(message: string | undefined) {
    if (DEBUG) {
        console.log(message);
    }
    console.log(message);
}

export function getWorkspacePath(): string {
    let configuredPath = vscode.workspace.getConfiguration('git-highlighter').get<string>('commitListPath'); //TODO: DOUBLE CHECK THIS, MIGHT HAVE DEPRECATED
    if (!configuredPath || (configuredPath === "")) {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage(`No path configured or no workspace open`);
            return '';
        }
        configuredPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    console.log(`Workspace path: ${configuredPath}`);
    return configuredPath;
}

export function getCommitList(): string[] {

    let branches = vscode.workspace.getConfiguration('git-highlighter').get<string[]>('highlightList');
    if (!branches || (branches.length === 0)) {
        let commitListPath = path.join(getWorkspacePath(), '.vscode/CommitList');
        if (fs.existsSync(commitListPath)) {
            branches = fs.readFileSync(path.join(getWorkspacePath(), '.vscode/CommitList'), 'utf8').split('\n');
        }
    }
    console.log(`branches set: ${branches}`);
    if (!branches || (branches.length === 0)) {
        vscode.window.showErrorMessage(`No commits found in CommitList: ${branches}`);
        return [];
    }

    return branches;

}