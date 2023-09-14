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
        fs.access(gitFolderPath, (err: Error | null) => {
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
    
    //highlightTest(context);
    //return;
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
export function deactivate() { }


/*
vscode.workspace.onDidChangeTextDocument(async e => {
    const document = e.document;

    // Read the last saved version of the file from the file system
    const fileData = await vscode.workspace.fs.readFile(document.uri);
    const fileText = new TextDecoder().decode(fileData);

    // Get the unsaved content of the document
    const editorText = document.getText();

    // Use the 'diff' package to compare the two versions of the text
    const changes = diff.diffLines(fileText, editorText);

    // 'changes' is now an array of change objects, which you can use to determine what lines have been added or modified
    changes.forEach((change: any) => {
        if (change.added) {
            console.log(`Added: ${change.value}`);
        } else if (change.removed) {
            console.log(`Removed: ${change.value}`);
        }
    });
});
*/
/*
import * as cp from 'child_process';
import { execSync } from 'child_process';
function executeCommand(command: string): string {
    try {

        const output = execSync(`cd ${vscode.workspace.workspaceFolders} && ${command}`);
        const outputString = output.toString();
        console.log(`Completed for command "${command}": ${outputString.length}`);
        return outputString;
    } catch (error) {
        console.error(`Error executing command "${command}":`); //seems to be trigged by deleted file that has blame in it...
        vscode.window.showErrorMessage(`Error executing command: ${command}`);
        return "";
    }
}*/
/*
vscode.workspace.onDidChangeTextDocument(async e => {
    console.log("test");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No editor is active');
        return;
    }

    const document = editor.document;
    if (document.isUntitled) {
        vscode.window.showInformationMessage('The file has not been saved yet');
        return;
    }

    const unsavedContent = document.getText();
    const gitBlame = cp.spawn('git', ['blame', '--contents=-'], { cwd: vscode.workspace.rootPath });

    gitBlame.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    gitBlame.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    gitBlame.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });

    gitBlame.stdin.write(unsavedContent);
    gitBlame.stdin.end();
});

function clearHighlights(document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {//todo try catch
        const lines = [] || [];
        decorationType.dispose();
        const ranges = lines.map(line => document.lineAt(line).range);
        editor.setDecorations(decorationType, ranges);
    }
}*/
/*x

let highlights: { [uri: string]: number[] } = {};
let decorationType: vscode.TextEditorDecorationType;
decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "#259b27e" as string,
    isWholeLine: true,
    //overviewRulerColor: color as string,
});

function fillHighlights() {
    highlights["file:///Users/cb/Git/Git-Changes-Highlighter/git-highlighter/src/test/highlighttext.txt"] = [];
    for (let i = 0; i < 50; i++) {
        highlights["file:///Users/cb/Git/Git-Changes-Highlighter/git-highlighter/src/test/highlighttext.txt"].push(i);
    }
}
function clearHighlights(document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {//todo try catch
        const lines = [] || [];
        decorationType.dispose();
        const ranges = lines.map(line => document.lineAt(line).range);
        editor.setDecorations(decorationType, ranges);
    }
}
function highlightTest(context: vscode.ExtensionContext) {

    fillHighlights();
    vscode.workspace.onDidSaveTextDocument(async e => {
        
        //console.log('onDidSaveTextDocument');
        const document = e;
        const editor = vscode.window.visibleTextEditors.find(editor => editor.document === e);
    
        if (document && editor) {
            const uri = document.uri.toString();

            //console.log(`Loading file: ${uri}`);
    
            const lines = highlights[uri] || [];
            //console.log(`applying highlights to: ${uri}`);
            //console.log(`Lines: ${lines}`);
            const color = vscode.workspace.getConfiguration('GitVision').get('highlightColor');
    
            decorationType.dispose(); 
            decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: color as string,
                isWholeLine: true,
                //overviewRulerColor: color as string,
            });
            const ranges = lines.map(line => document.lineAt(line).range);
            editor.setDecorations(decorationType, ranges);
        }

    });

    vscode.workspace.onDidChangeTextDocument(e => {
        console.log(`onDidChangeTextDocument ${e.document.uri.toString()}`);
        const uri = e.document.uri.toString();
        console.log(`Change on: ${uri}`)
        for (const change of e.contentChanges) {
            console.log(`Change: ${change.text}`);
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const line = editor.selection.active.line;
            const uri = editor.document.uri.toString();
            const lines = [] || [];
            decorationType.dispose();

            let start = new vscode.Position(5, 0);  // Line 6, Column 1
            let end = new vscode.Position(5, 10);  // Line 6, Column 11
            let ranges = [new vscode.Range(start, end)];
            //const ranges = lines.map(line => document.lineAt(line).range);
            editor.setDecorations(decorationType, ranges);
        }

    });

}*/