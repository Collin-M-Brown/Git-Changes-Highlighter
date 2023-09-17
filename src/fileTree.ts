import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class FileTreeItem extends vscode.TreeItem {
    children: { [key: string]: FileTreeItem } | undefined;

    constructor(
        public label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public resourceUri: vscode.Uri,
        public isRoot: boolean,
        children?: { [key: string]: FileTreeItem },
        public description?: string,
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = description || this.label;
        this.children = children;
    
        // If this is a root node, need to generate a unique ID for it each time it's created.
        if (isRoot) {
            this.id = `${label}-${Date.now()}`;
        } else {
            this.id = `${label}-${resourceUri.fsPath}`;
        }
    
        if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [this.resourceUri],
            };
        }
    }
}

export class fileTree implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined> = new vscode.EventEmitter<FileTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined> = this._onDidChangeTreeData.event;
    private changeCountMap: Map<string, number> = new Map<string, number>();
    //private collapseState: vscode.TreeItemCollapsibleState;

    private fileTree: FileTreeItem | undefined;

    constructor(private workspaceRoot: string, private filesChanged: Set<string>) {
        //this.collapseState = collapseState;
        this.buildFileTree();
    }

    getFileTree(): FileTreeItem | undefined {
        return this.fileTree;
    }

    refresh(): void {
        this.buildFileTree();
        this._onDidChangeTreeData.fire(undefined);
    }

    buildFileTree() {
        let tree: { [key: string]: FileTreeItem } = {};
        for (let filePath of this.filesChanged) {
            filePath = path.relative(this.workspaceRoot, filePath);
            let parts = filePath.split(path.sep);
            let subtree = tree;
    
            for (let i = 0; i < parts.length; i++) {
                let part = parts[i];
                if (!(part in subtree)) {
                    let isDirectory = (i < parts.length - 1) || fs.statSync(path.join(this.workspaceRoot, filePath)).isDirectory();
                    let resourceUri = vscode.Uri.file(path.join(this.workspaceRoot, ...parts.slice(0, i + 1)));
                    let changeCount = this.changeCountMap.get(resourceUri.fsPath) || 0;
                    let description = !isDirectory ? `(${changeCount})` : undefined;
                    subtree[part] = new FileTreeItem(
                        part, 
                        isDirectory ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, 
                        resourceUri, 
                        false, 
                        {}, 
                        description,
                    );
                }
                subtree = subtree[part].children || {};
            }
        }
        let rootLabel = path.basename(this.workspaceRoot);
        this.fileTree = new FileTreeItem(rootLabel, vscode.TreeItemCollapsibleState.Expanded, vscode.Uri.file(this.workspaceRoot), true, tree);
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

    updateFiles(newFiles: Map<string, number>): void {
        this.changeCountMap = newFiles;
        this.filesChanged = new Set<string>(newFiles.keys());
        this.buildFileTree();
        this._onDidChangeTreeData.fire(undefined);
    }
}