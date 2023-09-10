import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class FileTreeItem extends vscode.TreeItem {
    children: { [key: string]: FileTreeItem } | undefined;

    constructor(
        public label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public resourceUri: vscode.Uri,
        children?: { [key: string]: FileTreeItem },
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = this.label;
        this.children = children;

        if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [this.resourceUri],
            };
        }
    }
}

export class FileDataProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined> = new vscode.EventEmitter<FileTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined> = this._onDidChangeTreeData.event;
    private collapseState: vscode.TreeItemCollapsibleState;

    private fileTree: FileTreeItem | undefined;

    constructor(private workspaceRoot: string, private filesChanged: Set<string>, collapseState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded) {
        this.collapseState = collapseState;
        this.buildFileTree();
    }

    refresh(): void {
        this.buildFileTree();
        this._onDidChangeTreeData.fire(undefined);
    }

    buildFileTree() {
        let tree: { [key: string]: FileTreeItem } = {};
        for (let filePath of this.filesChanged) {
            let parts = filePath.split(path.sep);
            let subtree = tree;

            for (let i = 0; i < parts.length; i++) {
                let part = parts[i];
                if (part in subtree) {
                    console.log(`attempting to collpase ${this.collapseState}`);
                    subtree[part].collapsibleState = this.collapseState;
                } else {
                    let isDirectory = (i < parts.length - 1) || fs.statSync(path.join(this.workspaceRoot, filePath)).isDirectory();
                    let resourceUri = vscode.Uri.file(path.join(this.workspaceRoot, ...parts.slice(0, i + 1)));
                    //console.log(`Tree part: ${part}, resource: ${resourceUri}`);
                    subtree[part] = new FileTreeItem(part, isDirectory ? this.collapseState : vscode.TreeItemCollapsibleState.None, resourceUri, {});
                }
                subtree = subtree[part].children || {};
            }
        }
        let rootLabel = path.basename(this.workspaceRoot);
        this.fileTree = new FileTreeItem(rootLabel, this.collapseState, vscode.Uri.file(this.workspaceRoot), tree);
    }

    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileTreeItem): Thenable<FileTreeItem[]> {
        if (element) {
            return Promise.resolve(Object.values(element.children || {}));
        } else {
            return Promise.resolve(this.fileTree ? [this.fileTree] : []);
        }
    }

    collapseAll(): void {
        this.collapseState = vscode.TreeItemCollapsibleState.Collapsed;
    }

    updateFiles(newFiles: Set<string>): void {
        this.filesChanged = newFiles;
        this.buildFileTree();
        this._onDidChangeTreeData.fire(undefined);
    }
}