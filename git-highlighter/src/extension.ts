// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debugLog, getWorkspacePath } from './library';
import { CommandProcessor } from './commands';
import { CommitListViewProvider, Commit } from './commitView';
import { GitProcessor } from './gitHelper';

//let gitObject: GitProcessor;
let commandProcessor: CommandProcessor;

export async function activate(context: vscode.ExtensionContext) {

    //look into this for maintaining state
    //let count = context.globalState.get<number>('count');
    //if (count === undefined) {
    //    count = 0;
    //}
    //debugLog(`Count is ${count}`);
    //context.globalState.update('count', count + 1);
    
    //Initialize Command Processor
    if (!commandProcessor) {
        commandProcessor = await CommandProcessor.create(context);
    }

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

    commandProcessor.addCommit(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
