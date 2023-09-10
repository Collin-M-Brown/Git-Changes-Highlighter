// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debugLog, getWorkspacePath } from './library';
import { CommandProcessor } from './commands';

//let gitObject: GitProcessor;
let commandProcessor: CommandProcessor;

export async function activate(context: vscode.ExtensionContext) {
    //Initialize Command Processor
    if (!commandProcessor) {
        commandProcessor = await CommandProcessor.create();
    }


    // Register the commands

    //highlight current line
    commandProcessor.highlightLine(context);

    //show all commits in commit list
    commandProcessor.highlightCommits(context);

    //show all uncommited changes
    commandProcessor.highlightCurrent(context);

    //Show all changes in current branch
    commandProcessor.highlightBranch(context);

    commandProcessor.clearAllHighlights(context);

    //Display Tree in sidebar view
    commandProcessor.updateTreeFiles(context);

    commandProcessor.collapseAll(context);
    
}

// This method is called when your extension is deactivated
export function deactivate() {}
