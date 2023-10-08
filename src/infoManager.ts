import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const outputChannel = vscode.window.createOutputChannel("GitVision Logs");
export class InfoManager {
    static STRESS_DEBUG = false;
    static DEBUG = vscode.workspace.getConfiguration('GitVision').get('debugLog');
    static TEST_MERGED_COMMITS = vscode.workspace.getConfiguration('GitVision').get('testMergedOnly');

    static debugLog(message: string | undefined) {
        if (this.DEBUG) {
            if (message === undefined)
                return;
            outputChannel.appendLine(message);
            //outputChannel.show(true);
        }
    }

    static basicInfo(message: string) {
        if (vscode.workspace.getConfiguration('GitVision').get('showBasicInfoMessages')) {
            vscode.window.showInformationMessage(`${message}`, "Disable Notifications").then(selection => {
                if (selection === "Disable Notifications") {
                    //vscode.workspace.getConfiguration('GitVision').update('showBasicInfoMessages', false, vscode.ConfigurationTarget.Global);
                    //vscode.workspace.getConfiguration('GitVision').update('showBasicInfoMessages', undefined, vscode.ConfigurationTarget.Workspace);
                    vscode.commands.executeCommand('workbench.action.openSettings', 'GitVision.showBasic');
                }
            });
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

export class Mutex {
    private mutex = Promise.resolve();
    private isLocked = false;

    lock(): PromiseLike<() => void> {
        let begin: (unlock: () => void) => void = unlock => {};

        this.mutex = this.mutex.then(() => {
            return new Promise(begin);
        });

        this.isLocked = true;

        return new Promise(res => {
            begin = res;
        });
    }

    unlock(): void {
        this.isLocked = false;
    }

    async dispatch<T>(fn: (() => T) | (() => PromiseLike<T>)): Promise<T | null> {
        if (this.isLocked) {
            InfoManager.basicInfo(`A command is still running. Please wait for it to finish.`);
            return null;
        }

        return this.execute(fn);
    }

    async queue<T>(fn: (() => T) | (() => PromiseLike<T>)): Promise<T> {

        return this.execute(fn);
    }

    private async execute<T>(fn: (() => T) | (() => PromiseLike<T>)): Promise<T> {
        const unlock = await this.lock();
        try {
            return await Promise.resolve(fn());
        } finally {
            unlock();
            this.unlock();
        }
    }

    get locked(): boolean {
        return this.isLocked;
    }
}