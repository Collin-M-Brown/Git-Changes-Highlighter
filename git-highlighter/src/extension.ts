// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debugLog, getWorkspacePath } from './library';
import { highlightCommits, highlightLine, applyHighlights } from './commands';
import { GitProcessor } from './gitHelper';
import { FileDataProvider } from './fileTree';

let started = false;
let diffLog: string;
let gitObject: GitProcessor = new GitProcessor();

export async function activate(context: vscode.ExtensionContext) {
    // Check if editor window has changed and load highlights if it has
    // Apply the highlights to any editor that becomes visible
    vscode.window.onDidChangeVisibleTextEditors((editors: any) => {
        for (const editor of editors) {
            applyHighlights(editor.document);
        }
    });
    if (!started) {
        diffLog = await gitObject.getJsonHighlights();
        started = true;
    }
    //vscode.window.showInformationMessage("git-highlighter: activated.");

    //TODO: add file watcher to update
    // Register the commands

    //git-highlighter: Highlight Line
    highlightLine(context);

    //git-highlighter: Highlight Commits
    highlightCommits(context, diffLog);

    //TreeView
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
        const rootPath = workspaceFolders[0].uri.fsPath;
        const fileDataProvider = new FileDataProvider(rootPath, gitObject.getFilesChanged());
        vscode.window.registerTreeDataProvider('yourView', fileDataProvider);
    }
    
}

// This method is called when your extension is deactivated
export function deactivate() {}
