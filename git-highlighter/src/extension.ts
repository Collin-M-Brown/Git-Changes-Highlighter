/*
Code flow: 
                          -> highlight.ts 
extension.ts->commands.ts -> commitView.ts/fileTree.ts
                          -> gitHelper.ts
*/
import * as vscode from 'vscode';
import { CommandProcessor } from './commands';
const fs = require('fs');
const path = require('path');

let commandProcessor: CommandProcessor;

function isGitRepository() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return Promise.resolve(false);
    }
  
    const gitFolderPath = path.join(workspaceFolders[0].uri.fsPath, '.git');
    return new Promise(resolve => {
      fs.access(gitFolderPath, (err: Error | null)  => {
        resolve(!err);
      });
    });
}

export async function activate(context: vscode.ExtensionContext) {
    const isRepo = await isGitRepository();
    vscode.commands.executeCommand('setContext', 'GitVision.isGitRepository', isRepo);
    if (!isRepo) {
        return;
    }

    //Initialize Command Processor
    if (!commandProcessor) {
        commandProcessor = await CommandProcessor.create(context);
    }
    context.subscriptions.push(vscode.commands.registerCommand('GitVision.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'GitVision');
    }));

    //highlight current line
    commandProcessor.highlightLine(context);

    //show all commits in commit list
    commandProcessor.highlightCommits(context);

    //show all uncommited changes
    commandProcessor.highlightCurrent(context);

    //Show all changes in current branch
    commandProcessor.highlightBranch(context);

    // Add a commit to the commit list
    commandProcessor.addCommit(context);

    // Remove a commit from the commit list
    commandProcessor.removeCommit(context);

    // Hide the highlights but keep the commit list
    commandProcessor.hideHighlights(context);
    
    // Clear the highlights and commit list
    commandProcessor.clearAllHighlights(context);
    
    // Collapse the tree view
    commandProcessor.collapseAll(context);

    // Expand the tree view
    commandProcessor.expandAll(context);
    
    //Display Tree in sidebar view
    commandProcessor.updateTreeFiles(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
