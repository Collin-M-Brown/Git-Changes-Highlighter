/*
Code flow: 
                          -> highlight.ts 
extension.ts->commands.ts -> commitView.ts/fileTree.ts
                          -> fileManager.ts
*/
import * as vscode from 'vscode';
import { CommandProcessor } from './commands';
import { execSync } from 'child_process';
import * as os from 'os';


import { InfoManager as ms } from './infoManager';

let commandProcessor: CommandProcessor;
export let GIT_REPO: string;

function getGitRepo(): boolean {
    try {
        ms.debugLog(`workspace path: ${ms.getWorkspacePath()}`);
        GIT_REPO = execSync(`cd ${ms.getWorkspacePath()} && git rev-parse --show-toplevel`).toString().trim();// maybe cd at start
        if (os.platform() === 'win32') {
            GIT_REPO = GIT_REPO.toLocaleLowerCase();
        }
        
        ms.debugLog(`git repo found : ${GIT_REPO}`);
        return GIT_REPO.length !== 0;
    } catch (error) {
        return false;
    }
}

export async function activate(context: vscode.ExtensionContext) {
    //startProfile();
    const isRepo = getGitRepo();
    //console.log(`GitVision: ${isRepo}, ${GIT_REPO}}`);
    vscode.commands.executeCommand('setContext', 'GitVision.isGitRepository', isRepo);
    if (!isRepo)
        return;

    //Initialize Command Processor
    if (!commandProcessor)
        commandProcessor = await CommandProcessor.create(context);
        context.subscriptions.push(vscode.commands.registerCommand('GitVision.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'GitVision.');
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
    commandProcessor.updateTreeFiles();

    commandProcessor.openFilter(context);

    commandProcessor.clearFilter(context);

    commandProcessor.repoWatcher();

    commandProcessor.registerJumpCommands(context);

    // trigger highlight from list command at start
    await vscode.commands.executeCommand('GitVision.highlightCommits');
}

export function deactivate() { }
