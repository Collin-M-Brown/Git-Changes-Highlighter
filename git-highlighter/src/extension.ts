// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debugLog, getWorkspacePath } from './library';
import { CommandProcessor } from './commands';
import { CommitListViewProvider, Commit } from './commitView'

//let gitObject: GitProcessor;
let commandProcessor: CommandProcessor;

export async function activate(context: vscode.ExtensionContext) {

    //look into this for maintaining state
    //let count = context.globalState.get<number>('count');
    //if (count === undefined) {
    //    count = 0;
    //}
    //console.log(`Count is ${count}`);
    //context.globalState.update('count', count + 1);
    
    //Initialize Command Processor
    if (!commandProcessor) {
        commandProcessor = await CommandProcessor.create();
    }

    //const commitListViewProvider = new CommitListViewProvider();
    //vscode.window.registerTreeDataProvider('CommitView', commitListViewProvider);
    //// Register your command here
    //`//vscode.commands.executeCommand('gmap.testCommit', { commitMessage: 'Test' });

    const commitListViewProvider = new CommitListViewProvider();
    const treeView = vscode.window.createTreeView('CommitView', {
      treeDataProvider: commitListViewProvider,
    });

    // Save reference to treeView for later
    context.subscriptions.push(treeView);

    vscode.commands.registerCommand('gmap.testCommit', (commitItem) => {
        console.log(`You clicked commit1: ${commitItem.commitMessage}`);
        vscode.window.showInformationMessage(`You clicked commit: ${commitItem.commitMessage}`);

    });
    commitListViewProvider.addCommit("test1", "1");
    commitListViewProvider.addCommit("test2", "2");
    commitListViewProvider.addCommit("test0", "5");
    commitListViewProvider.addCommit("test3", "3");
    commitListViewProvider.addCommit("dummy", "0");

    let ignoreNextSelectionChange = false;
    treeView.onDidChangeSelection(e => {
        if (ignoreNextSelectionChange) {
            ignoreNextSelectionChange = false;
        } else if (e.selection.length > 0) {
            const item = e.selection[0] as Commit;
            // Ignore dummy commit
            if (item.commitMessage !== "dummy") {
                vscode.window.showInformationMessage(`You clicked on commit: ${item.commitMessage}`);
                ignoreNextSelectionChange = true;
                commitListViewProvider.removeCommit(item.commitMessage);
            }
        }
    });

    // Register the commands
    //(await vscode.commands.getCommands(true)).forEach(command=>debugLog(command));
    //vscode.commands.executeCommand("");

    //highlight current line
    commandProcessor.highlightLine(context);

    //show all commits in commit list
    commandProcessor.highlightCommits(context);

    //show all uncommited changes
    commandProcessor.highlightCurrent(context);

    //Show all changes in current branch
    commandProcessor.highlightBranch(context);

    commandProcessor.clearAllHighlights(context);
    
    commandProcessor.collapseAll(context);
    commandProcessor.expandAll(context);
    
    //Display Tree in sidebar view
    commandProcessor.updateTreeFiles(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
