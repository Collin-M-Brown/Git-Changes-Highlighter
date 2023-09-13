import * as vscode from 'vscode';
import { exit } from 'process';
import { debugLog, getWorkspacePath } from './library';
import { GitProcessor } from './gitHelper';
import { FileDataProvider } from './fileTree';
import { HighlightProcessor } from './highlighter';
import { CommitListViewProvider } from './commitView';

export class CommandProcessor {
    private gitObject!: GitProcessor;
    private hp: HighlightProcessor;
    private fileDataProvider!: FileDataProvider;
    private commitView: CommitListViewProvider;
    private commitRepo: CommitListViewProvider;
    private commitViewDropdown: vscode.TreeView<{ [key: string]: string }>;
    private commitRepoDropdown: vscode.TreeView<{ [key: string]: string }>;

    private constructor(context: vscode.ExtensionContext) {
        this.fileDataProvider = new FileDataProvider(getWorkspacePath(), new Set<string>());
        vscode.window.registerTreeDataProvider('gitHighlightsView', this.fileDataProvider);

        this.hp = new HighlightProcessor();
        this.commitView = new CommitListViewProvider();
        this.commitRepo = new CommitListViewProvider();
        this.commitViewDropdown = vscode.window.createTreeView('CommitView', { treeDataProvider: this.commitView});
        this.commitRepoDropdown = vscode.window.createTreeView('CommitRepo', { treeDataProvider: this.commitRepo});

        context.subscriptions.push(this.commitViewDropdown);
        context.subscriptions.push(this.commitRepoDropdown);
    }

    static async create(context: vscode.ExtensionContext) {
        const commandProcessor = new CommandProcessor(context);
        commandProcessor.gitObject = await GitProcessor.create();
        commandProcessor.commitRepo.loadCommits(commandProcessor.gitObject.getCommitList());
        vscode.window.onDidChangeVisibleTextEditors((editors: any) => {
            for (const editor of editors) {
                //console.debug(`Editor changed: ${editor.document.uri.path}`);
                commandProcessor.hp.applyHighlights(editor.document);
            }
        });
        return commandProcessor;
    }

    highlightLine(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.highlightLine', () => {
            debugLog("Running command: GitVision.highlightLine");
            this.hp.highlightLine();
        });
        debugLog("highlight:line registered");
        context.subscriptions.push(disposable);
    }

    highlightCommits(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.highlightCommits', async () => {
            try {
                debugLog("Running command: GitVision.highlightCommits");
                {
                    this.gitObject.clearHighlightData();
                    this.hp.clearAllHighlights();
                    this.updateTreeFiles(context);
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
                vscode.window.showErrorMessage("diff-highlighter failed to run.");
            }
        });
        context.subscriptions.push(disposable);
    }

    highlightCurrent(context: vscode.ExtensionContext) {
        return; //Disabled for now
        let disposable = vscode.commands.registerCommand('GitVision.highlightUncommitedChanges', async () => {
            try {
                    debugLog("Running command: GitVision.highlightUncommitedChanges");
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
        return; //Disabled for now
        let disposable = vscode.commands.registerCommand('GitVision.highlightBranch', async () => {
            try {
                debugLog("Running command: GitVision.highlightBranch");
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
        let disposable = vscode.commands.registerCommand('GitVision.clearAll', async () => {
            debugLog("Running command: GitVision.clearAll");
            let confirmation = await vscode.window.showInformationMessage('Are you sure you want to clear the list?', { modal: true }, 'Yes', 'No');

            if (confirmation === 'Yes') {
                this.commitRepo.loadCommits(this.commitView.getCommits());
                this.commitView.clear();
                this.gitObject.clearHighlightData();
                this.hp.clearAllHighlights();
                this.updateTreeFiles(context);
            }
        });
        context.subscriptions.push(disposable);
    }

    updateTreeFiles(context: vscode.ExtensionContext) {
        if (this.fileDataProvider) {
            this.fileDataProvider.updateFiles(this.gitObject.getHighlightFiles());
        }
    }

    collapseAll(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.collapseAll', async () => {
            vscode.commands.executeCommand('workbench.actions.treeView.gitHighlightsView.collapseAll');
        });
        context.subscriptions.push(disposable);
    }

    expandAll(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.expandAll', async () => {
            debugLog("Running command: GitVision.expandAll");
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
        let commits: { [key: string]: string } = {};
        this.commitRepoDropdown.onDidChangeSelection(e => {
            //debugLog("hi");
            if (e.selection.length > 0) {
                if (!found) {
                    const item = e.selection[0] as { key: string, value: string };;
                    //vscode.window.showInformationMessage(`You clicked on commit: ${item.commitMessage}`);
                    debugLog(`You clicked on commit: ${item.key}`);
                    commits = this.commitRepo.getCommits();
                    delete commits[item.key];
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

    removeCommit(context: vscode.ExtensionContext) {
        let found = false;
        let commits: { [key: string]: string } = {};
        this.commitViewDropdown.onDidChangeSelection(e => {
            //debugLog("hi");
            if (e.selection.length > 0) {
                if (!found) {
                    const item = e.selection[0] as { key: string, value: string };;
                    debugLog(`You clicked on commit: ${item.key}`);
                    commits = this.commitView.getCommits();
                    delete commits[item.key];
                    this.commitRepo.addCommit(item);
                    this.commitView.clear();
                    found = true;
                }
            }
            else {
                //debugLog(`loading commits ${commits}`);
                this.commitView.loadCommits(commits);
                found = false;
            }
        });
    }

    hideHighlights(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.hideHighlights', async () => {
            debugLog("Running command: GitVision.hideHighlights");
            this.hp.clearAllHighlights();
        });
        context.subscriptions.push(disposable);
    }
}