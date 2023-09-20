import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class InfoManager {
    static STRESS_DEBUG = false;
    static DEBUG = false;

    static debugLog(message: string | undefined) {
        if (this.DEBUG)
            console.log(message);
    }

    static basicInfo(message: string) {
        if (vscode.workspace.getConfiguration('GitVision').get('showBasicInfoMessages')) {
            vscode.window.showInformationMessage(`${message}`, "Disable Notifications").then(selection => {
                if (selection === "Disable Notifications") {
                    vscode.workspace.getConfiguration('GitVision').update('showBasicInfoMessages', false, vscode.ConfigurationTarget.Global);
                    vscode.workspace.getConfiguration('GitVision').update('showBasicInfoMessages', undefined, vscode.ConfigurationTarget.Workspace);
                }
            });
        }
    }   

    static debugInfo(message: string) {
        if (vscode.workspace.getConfiguration('GitVision').get('showDebugInfoMessages')) {

        }
    }

    static getWorkspacePath(): string {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage(`No path configured or no workspace open`);
            return '';
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    static getCommitList(): string[] {

        let branches = vscode.workspace.getConfiguration('GitVision').get<string[]>('highlightList');
        if (!branches || (branches.length === 0)) {
            let commitListPath = path.join(this.getWorkspacePath(), '.vscode/CommitList');
            if (fs.existsSync(commitListPath))
                branches = fs.readFileSync(path.join(this.getWorkspacePath(), '.vscode/CommitList'), 'utf8').split('\n');
        }
    //debugLog(`branches set: ${branches}`);
        if (!branches || (branches.length === 0)) {
            vscode.window.showErrorMessage(`No commits found in CommitList: ${branches}`);
            return [];
        }

        return branches;

    }
}
