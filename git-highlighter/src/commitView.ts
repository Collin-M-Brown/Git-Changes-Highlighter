import * as vscode from 'vscode';
import { debugLog, DEBUG } from './library';

export class CommitListViewProvider implements vscode.TreeDataProvider<Commit> {
    private _onDidChangeTreeData: vscode.EventEmitter<Commit | undefined | null | void> = new vscode.EventEmitter<Commit | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Commit | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private commits: Commit[] = [];
    
    getTreeItem(element: Commit): vscode.TreeItem {
        return element;
    }
    
    getChildren(element?: Commit): Thenable<Commit[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            return Promise.resolve(this.commits.sort((a, b) => b.date.getTime() - a.date.getTime()));
        }
    }
    
    
    addCommit(commit: Commit) {
        //const commit = new Commit(commitMessage, new Date(date));
        this.commits.push(commit);
        this._onDidChangeTreeData.fire();
        //this._onDidChangeTreeData.event;
    }
    
    //removeCommit(commitMessage: string) {
    //    debugLog(`Removing commits with message: ${commitMessage}`);
    //    this.commits = this.commits.filter(c => c.commitMessage !== commitMessage);
    //}

    clear() {
        this.commits = [];
        this._onDidChangeTreeData.fire();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    loadCommits(newCommits: Commit[]) {
        newCommits.forEach(commit => this.commits.push(commit));
        this._onDidChangeTreeData.fire();
    }

    getCommits() {
        return this.commits;
    }
}

export class Commit extends vscode.TreeItem {
    constructor(public readonly commitMessage: string, public readonly date: Date) {
        super(commitMessage, vscode.TreeItemCollapsibleState.None);
        this.description = `Date: ${date.toLocaleString()}`; // Display the date as the description of the TreeItem
        this.tooltip = `Commit: ${commitMessage}\nDate: ${date.toLocaleString()}`; // Display the commit message and date in the tooltip
    }
}
