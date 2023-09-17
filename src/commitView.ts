import * as vscode from 'vscode';
import { debugLog, DEBUG } from './library';

export class CommitListViewProvider implements vscode.TreeDataProvider<{ [key: string]: string }> {
    private _onDidChangeTreeData: vscode.EventEmitter<undefined | null | void> = new vscode.EventEmitter<undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<undefined | null | void> = this._onDidChangeTreeData.event;
    
    private commits: { [key: string]: string } = {};
    
    getTreeItem(element: { key: string, value: string }): vscode.TreeItem {
        return new vscode.TreeItem(element.key, vscode.TreeItemCollapsibleState.None);
    }
    
    getChildren(element?: { key: string, value: string }): Thenable<{ key: string, value: string }[]> {
        if (element) 
            return Promise.resolve([]);
        return Promise.resolve(Object.entries(this.commits).sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime()).map(([key, value]) => ({ key, value })));
    }
    
    addCommit(commit: { key: string, value: string }) {
        this.commits[commit.key] = commit.value;
        this._onDidChangeTreeData.fire();
    }
    
    clear() {
        this.commits = {};
        this._onDidChangeTreeData.fire();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    loadCommits(newCommits: { [key: string]: string }) {
        for (let key in newCommits)
            this.commits[key] = newCommits[key];
        this._onDidChangeTreeData.fire();
    }

    getCommits() {
        return this.commits;
    }
}