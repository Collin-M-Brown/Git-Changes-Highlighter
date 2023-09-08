import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = this.label;
    }
}

export class FileDataProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined> = new vscode.EventEmitter<FileTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileTreeItem): Thenable<FileTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No files in empty workspace');
            return Promise.resolve([]);
        }

        if (element) {
            const fileDirectory = path.join(this.workspaceRoot, element.label);
            return Promise.resolve(this.getFiles(fileDirectory));
        } else {
            return Promise.resolve(this.getFiles(this.workspaceRoot));
        }
    }

    private allowedFiles: string[] = ['file1.txt', 'file2.txt', 'file3.txt']; // Add file names you want to include

    private getFiles(directory: string): FileTreeItem[] {
        const files = fs.readdirSync(directory);
        return files
            .filter(file => this.allowedFiles.includes(file)) // Filter out unwanted files
            .map((file) => {
                const filePath = path.join(directory, file);
                const state = fs.statSync(filePath).isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
                return new FileTreeItem(file, state, vscode.Uri.file(filePath));
            });
    }
}