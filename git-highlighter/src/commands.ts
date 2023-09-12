import * as vscode from 'vscode';
import { exit } from 'process';
import { debugLog } from './library';
import { GitProcessor } from './gitHelper';
import { FileDataProvider } from './fileTree';
import { getWorkspacePath, getCommitList } from './library';
import { HighlightProcessor } from './highlighter';
import { CommitListViewProvider, Commit } from './commitView'

//import { fillGitHighlightData } from './gitHelper';

/*
Example format ofthis.highlights.json:
TODO: Add these files to watchlist and update when changed
{
    "file:///Users/cb/Git/Git-Changes-Highlighter/gmap/src/extension.ts": [
        15,
        22,
    ],
    "file:///Users/cb/Git/Git-Changes-Highlighter/gmap/src/gitHelper.ts": [
        ...,
    ]
}*/

export class CommandProcessor {
    //let jsonhighlights: string;
    private highlights: { [uri: string]: number[] };
    private gitObject!: GitProcessor;
    private hp: HighlightProcessor;
    private fileDataProvider!: FileDataProvider;
    private commitView: CommitListViewProvider;
    private commitRepo: CommitListViewProvider;
    private commitViewDropdown: vscode.TreeView<Commit>;
    private commitRepoDropdown: vscode.TreeView<Commit>;

    private constructor(context: vscode.ExtensionContext) {
        this.highlights = {};
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders !== undefined) {
            this.fileDataProvider = new FileDataProvider(workspaceFolders[0].uri.fsPath, new Set<string>);
            vscode.window.registerTreeDataProvider('gitHighlightsView', this.fileDataProvider);
        }
        else {
            vscode.window.showErrorMessage(`No workspace open`);
        }

        this.hp = new HighlightProcessor();
        this.commitView = new CommitListViewProvider();
        this.commitRepo = new CommitListViewProvider();
        this.commitViewDropdown = vscode.window.createTreeView('CommitView', { treeDataProvider: this.commitView});
        this.commitRepoDropdown = vscode.window.createTreeView('CommitRepo', { treeDataProvider: this.commitRepo});
        //this.

        context.subscriptions.push(this.commitViewDropdown);
        context.subscriptions.push(this.commitRepoDropdown);
    }

    static async create(context: vscode.ExtensionContext) {
        const commandProcessor = new CommandProcessor(context);
        commandProcessor.gitObject = await GitProcessor.create();
        commandProcessor.commitRepo.loadCommits(commandProcessor.gitObject.getCommitList());
        vscode.window.onDidChangeVisibleTextEditors((editors: any) => {
            for (const editor of editors) {
                commandProcessor.hp.applyHighlights(editor.document);
            }
        });
        return commandProcessor;
    }

    highlightLine(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('gmap.highlightLine', () => {
            debugLog("Running command: gmap.highlightLine");
            this.hp.highlightLine();
        });
        debugLog("highlight:line registered");
        context.subscriptions.push(disposable);
    }

    highlightCommits(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('gmap.highlightCommits', async () => {
            try {
                debugLog("Running command: gmap.highlightCommits");
                {
                    await this.gitObject.addCommits(this.commitView.getCommits()); //give commits to gitHelper to parse
                    this.hp.loadHighlights(this.gitObject.getGitHighlightData()); //load data to be highlighted
                    //debugLog(`JsonHighlights set: ${this.gitObject.getGitHighlightData()}`);
                }
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    this.hp.applyHighlights(editor.document);
                }
                this.updateTreeFiles(context);
            } catch (error) {
                vscode.window.showErrorMessage("diff-highlighter failed to run. Please check the console for more information.");
                exit(1);
            }
        });
        context.subscriptions.push(disposable);
    }

    highlightCurrent(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('gmap.highlightUncommitedChanges', async () => {
            try {
                    debugLog("Running command: gmap.highlightUncommitedChanges");
                    //await this.gitObject.addCommits(["Uncommitted changes"]); TODOFIX
                    this.hp.loadHighlights(this.gitObject.getGitHighlightData()); 
                    for (const editor of vscode.window.visibleTextEditors) {
                        this.hp.applyHighlights(editor.document);
                    }
                    this.updateTreeFiles(context);
                } catch (error) {
                    vscode.window.showErrorMessage("diff-highlighter failed to run. Please check the console for more information.");
                    exit(1);
                }
            });
        
            context.subscriptions.push(disposable);
    }

    highlightBranch(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('gmap.highlightBranch', async () => {
            try {
                debugLog("Running command: gmap.highlightBranch");
                await this.gitObject.addCurrentBranch();
                this.hp.loadHighlights(this.gitObject.getGitHighlightData());
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    this.hp.applyHighlights(editor.document);
                }
                this.updateTreeFiles(context);
            } catch (error) {
                vscode.window.showErrorMessage("diff-highlighter failed to run. Please check the console for more information.");
                exit(1);
            }
        });
    
        context.subscriptions.push(disposable);
    }

    clearAllHighlights(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('gmap.clearAll', () => {
            debugLog("Running command: gmap.clearAll");
            this.gitObject.clearHighlightData();
            this.hp.clearAllHighlights();
            this.updateTreeFiles(context);
        });
        context.subscriptions.push(disposable);
    }

    updateTreeFiles(context: vscode.ExtensionContext) {
        if (this.fileDataProvider) {
            this.fileDataProvider.updateFiles(this.gitObject.getHighlightFiles());
        }
    }

    collapseAll(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('gmap.collapseAll', async () => {
            vscode.commands.executeCommand('workbench.actions.treeView.gitHighlightsView.collapseAll');
        });
        context.subscriptions.push(disposable);
    }

    expandAll(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('gmap.expandAll', async () => {
            debugLog("Running command: gmap.expandAll");
            if (this.fileDataProvider) {
                //this.fileDataProvider.expandAll();
                this.fileDataProvider.updateFiles(new Set<string>());
                
                // Add a delay before adding the highlight data back
                setTimeout(() => {
                    this.updateTreeFiles(context);
                }, 250);  // Adjust the delay as needed: very sloppy
            }
        });
        context.subscriptions.push(disposable);
    }

    addCommit(context: vscode.ExtensionContext) {
        let found = false;
        let commits: Commit[] = [];
        this.commitRepoDropdown.onDidChangeSelection(e => {
            //debugLog("hi");
            if (e.selection.length > 0) {
                if (!found) {
                    const item = e.selection[0] as Commit;
                    //vscode.window.showInformationMessage(`You clicked on commit: ${item.commitMessage}`);
                    debugLog(`You clicked on commit: ${item.commitMessage}`);
                    // Remove the selected commit from the commits array
                    commits = this.commitRepo.getCommits().filter(c => c.commitMessage !== item.commitMessage);
                    this.commitView.addCommit(item);
                    this.commitRepo.clear();
                    found = true;
                }
            }
            else {
                //debugLog(`loading commits ${commits}`);
                this.commitRepo.loadCommits(commits);
                found = false;
            }
        });
    }
}