// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debugLog, getWorkspacePath } from './library';
import { CommandProcessor } from './commands';

//let gitObject: GitProcessor;
let commandProcessor: CommandProcessor;

export async function activate(context: vscode.ExtensionContext) {
    // Check if editor window has changed and load highlights if it has
    // Apply the highlights to any editor that becomes visible
    if (!commandProcessor) {
        commandProcessor = await CommandProcessor.create();
    }
    
    vscode.window.onDidChangeVisibleTextEditors((editors: any) => {
        for (const editor of editors) {
            commandProcessor.applyHighlights(editor.document);
        }
    });
    //vscode.window.showInformationMessage("git-highlighter: activated.");

    //TODO: add file watcher to update
    // Register the commands
    commandProcessor.highlightCurrent(context);

    //git-highlighter: Highlight Line
    commandProcessor.highlightLine(context);

    //git-highlighter: Highlight Commits
    commandProcessor.highlightCommits(context);

    //git-highlighter: Show current changes
    commandProcessor.highlightCurrent(context);

    commandProcessor.highlightBranch(context);

    commandProcessor.treeView(context);


    
}

// This method is called when your extension is deactivated
export function deactivate() {}
