import * as vscode from 'vscode';
import { exit } from 'process';
import { FileManager } from './fileManager';
import { fileTree } from './fileTree';
import { HighlightProcessor } from './highlighter';
import { CommitListViewProvider } from './commitView';
import { GIT_REPO } from './extension';
import * as fs from 'fs';
import * as path from 'path';
import { InfoManager as ms } from './infoManager';


export class CommandProcessor {
    private fileManager!: FileManager;
    private hp: HighlightProcessor;
    private fileTree!: fileTree;
    private commitView: CommitListViewProvider;
    private commitRepo: CommitListViewProvider;
    private commitViewDropdown: vscode.TreeView<{ [key: string]: string }>;
    private commitRepoDropdown: vscode.TreeView<{ [key: string]: string }>;
    private fileWatcherStarted = false;
    private commitsOn: boolean = false;

    private constructor(context: vscode.ExtensionContext) {
        this.fileTree = new fileTree(GIT_REPO, new Set<string>());
        vscode.window.registerTreeDataProvider('gitHighlightsView', this.fileTree);

        this.hp = new HighlightProcessor();
        this.commitView = new CommitListViewProvider();
        this.commitRepo = new CommitListViewProvider();
        this.commitViewDropdown = vscode.window.createTreeView('CommitView', { treeDataProvider: this.commitView });
        this.commitRepoDropdown = vscode.window.createTreeView('CommitRepo', { treeDataProvider: this.commitRepo });

        context.subscriptions.push(this.commitViewDropdown);
        context.subscriptions.push(this.commitRepoDropdown);
    }

    static async create(context: vscode.ExtensionContext) {
        const commandProcessor = new CommandProcessor(context);
        commandProcessor.fileManager = await FileManager.create();
        if (ms.STRESS_DEBUG)
            commandProcessor.commitView.loadCommits(commandProcessor.fileManager.getCommitList());
        else
            commandProcessor.commitRepo.loadCommits(commandProcessor.fileManager.getCommitList());
        vscode.window.onDidChangeVisibleTextEditors((editors: any) => {
            for (const editor of editors) {
                commandProcessor.hp.applyHighlights(editor.document);
            }
        });
        return commandProcessor;
    }

    highlightLine(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.highlightLine', () => {
            //debugLog("Running command: GitVision.highlightLine");
            this.hp.highlightLine();
        });
        //debugLog("highlight:line registered");
        context.subscriptions.push(disposable);
    }

    highlightCommits(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.highlightCommits', async () => {
            //debugLog("Running command: GitVision.highlightCommits");

            this.fileManager.clearHighlightData();
            this.hp.clearAllHighlights();
            this.updateTreeFiles(context);
            await this.fileManager.addCommits(this.commitView.getCommits()); //give commits to fileManager to parse
            this.hp.loadHighlights(this.fileManager.getGitHighlightData()); //load data to be highlighted
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                this.hp.applyHighlights(editor.document);
            }
            this.updateTreeFiles(context);
            if (!this.fileWatcherStarted) {
                this.fileWatcher();
                this.fileWatcherStarted = true;
            }
            this.commitsOn = true;
        });
        context.subscriptions.push(disposable);
    }

    highlightCurrent(context: vscode.ExtensionContext) {
        return; //Disabled for now
        let disposable = vscode.commands.registerCommand('GitVision.highlightUncommitedChanges', async () => {
            try {
                //debugLog("Running command: GitVision.highlightUncommitedChanges");
                //await this.fileManager.addCommits(["Uncommitted changes"]); TODOFIX
                this.hp.loadHighlights(this.fileManager.getGitHighlightData());
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
                //debugLog("Running command: GitVision.highlightBranch");
                await this.fileManager.addCurrentBranch();
                this.hp.loadHighlights(this.fileManager.getGitHighlightData());
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
            //debugLog("Running command: GitVision.clearAll");
            let confirmation = await vscode.window.showInformationMessage('Are you sure you want to clear the list?', { modal: true }, 'Yes', 'No');

            if (confirmation === 'Yes') {
                this.commitRepo.loadCommits(this.commitView.getCommits());
                this.commitView.clear();
                this.fileManager.clearHighlightData();
                this.hp.clearAllHighlights();
                this.updateTreeFiles(context);
                this.commitsOn = false;
            }
        });
        context.subscriptions.push(disposable);
    }

    updateTreeFiles(context: vscode.ExtensionContext) {
        if (this.fileTree) {
            this.fileTree.updateFiles(this.fileManager.getHighlightFiles());
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
            //debugLog("Running command: GitVision.expandAll");
            if (this.fileTree) {
                //this.fileTree.expandAll();
                this.fileTree.updateFiles(new Map<string, number>());
                setTimeout(() => {
                    this.updateTreeFiles(context);
                }, 200);  //very cringe but tree needs time to update
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
                    //debugLog(`You clicked on commit: ${item.key}`);
                    commits = this.commitRepo.getCommits();
                    const bundleBranches = vscode.workspace.getConfiguration('GitVision').get('bundleMergedBranches');
                    if (bundleBranches) {
                        const brothers = this.fileManager.getBrothers(item.key);
                        for (let item of Object.entries(brothers)) {
                            const [key, value] = item;
                            delete commits[key];
                            this.commitView.addCommit({ key, value });
                        }
                    }
                    else {
                        delete commits[item.key];
                        this.commitView.addCommit(item);
                    }
                    
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
                    //debugLog(`You clicked on commit: ${item.key}`);
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
            //debugLog("Running command: GitVision.hideHighlights");
            this.hp.clearAllHighlights();
            this.commitsOn = false;
        });
        context.subscriptions.push(disposable);
    }

    fileExistsInRepo(filePath: string): boolean {
        const relativePath = path.relative(GIT_REPO, filePath);
        return !relativePath.startsWith('..') && fs.existsSync(filePath);
    }

    fileWatcher() {
        vscode.workspace.onDidSaveTextDocument(async e => {
            if (this.commitsOn) {
                try {
                    const fileName = e.fileName;
                    if (!this.fileExistsInRepo(fileName))
                        return;
                    if (!await this.fileManager.updateFileHighlights(fileName))
                        return;
                    this.hp.loadFile(fileName, this.fileManager.getGitHighlightData()[fileName]);
                    this.hp.clearHighlights(e);
                    this.hp.applyHighlights(e);
                }
                catch (error) {
                }
            }
        });
    }
    filterCommitRepository(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('GitVision.filterCommitRepository', async () => {
            const filterString = vscode.workspace.getConfiguration('GitVision').get('filterString');
            let filter: string = "";

            if (filterString)
                filter = filterString.toString().toLowerCase();

            if (filter === "")
                vscode.window.showInformationMessage("Empty filter found in extension settings");

            console.debug(`filter = ${filter}`);
            this.commitRepo.loadFilter(filter);
            this.commitRepo.reload();
            
        });
        context.subscriptions.push(disposable);
    }
}