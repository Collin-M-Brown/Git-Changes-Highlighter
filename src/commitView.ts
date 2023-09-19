import * as vscode from 'vscode';

export class CommitListViewProvider implements vscode.TreeDataProvider<{ [key: string]: string }> {
    private _onDidChangeTreeData: vscode.EventEmitter<undefined | null | void> = new vscode.EventEmitter<undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<undefined | null | void> = this._onDidChangeTreeData.event;
    
    // <name,date>
    private allCommits: { [key: string]: string } = {};
    private commits: { [key: string]: string } = {};
    private filterString = "";
    private alphabet = 'mabcdefghijklnopqrstuv';
    getTreeItem(element: { key: string, value: string }): vscode.TreeItem {
        return new vscode.TreeItem(element.key, vscode.TreeItemCollapsibleState.None);
    }
    
    getChildren(element?: { key: string, value: string }): Thenable<{ key: string, value: string }[]> {
        if (element) 
            return Promise.resolve([]);
        return Promise.resolve(Object.entries(this.commits)
            .sort((a, b) => {
                // Sort by date
                const dateComparison = new Date(b[1]).getTime() - new Date(a[1]).getTime();
                if (dateComparison !== 0) return dateComparison;
    
                // If dates are equal, sort by custom alphabet order
                return this.alphabet.indexOf(a[0]) - this.alphabet.indexOf(b[0]);
            })
            .map(([key, value]) => ({ key, value })));
    }
    
    addCommit(commit: { key: string, value: string }) {
        this.allCommits[commit.key] = commit.value;
        if (commit.key.toLowerCase().includes(this.filterString)) {
            this.commits[commit.key] = commit.value;
        }
        this._onDidChangeTreeData.fire();
    }
    
    clear() {
        this.allCommits = {};
        this.commits = {};
        this._onDidChangeTreeData.fire();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    loadCommits(newCommits: { [key: string]: string }) {
        //for (let key in newCommits)
        //    this.commits[key] = newCommits[key];
        for (let key in newCommits) {
            this.allCommits[key] = newCommits[key];
            if (key.toLowerCase().includes(this.filterString)) {
                this.commits[key] = newCommits[key];
            }
        }
        this._onDidChangeTreeData.fire();
    }

    reload() {
        this.commits = {};
        for (let key in this.allCommits) {
            if (key.toLowerCase().includes(this.filterString) || this.filterString.length === 0) {
                this.commits[key] = this.allCommits[key];
            }
        }
        this._onDidChangeTreeData.fire();
    }

    loadFilter(filter: string) {
        this.filterString = filter;
    }

    getCommits() {
        return this.allCommits;
    }
}