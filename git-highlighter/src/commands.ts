import * as vscode from 'vscode';
import { exit } from 'process';
import { debugLog } from './library';
//import { compileDiffLog } from './gitHelper';

/*
Example format of highlights.json:
TODO: Add these files to watchlist and update when changed
{
    "file:///Users/cb/Git/Git-Changes-Highlighter/git-highlighter/src/extension.ts": [
        15,
        22,
    ],
    "file:///Users/cb/Git/Git-Changes-Highlighter/git-highlighter/src/gitHelper.ts": [
        ...,
    ]
}*/
let jsonhighlights: string;
let highlights: { [uri: string]: number[] } = {};

let decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'transparent',
    isWholeLine: true,
});

function loadHighlights(newHighlights: {[uri: string]: number[]}) {
    for (const uri in newHighlights) {
        if (newHighlights.hasOwnProperty(uri)) {
            const lines = newHighlights[uri];
            if (!highlights[uri]) {
                highlights[uri] = [];
            }
            highlights[uri].push(...lines);
        }
    }
}

export function applyHighlights(document: vscode.TextDocument) {
    debugLog("Applying highlights in applyHighlights");
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        const uri = document.uri.toString();
        const lines = highlights[uri] || [];
        console.debug(`Lines: ${lines}`);
        const color = vscode.workspace.getConfiguration('git-highlighter').get('highlightColor');

        try {
            decorationType.dispose(); 
            decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: color as string,
                isWholeLine: true,
            });
        } catch(error) {
            console.error('Error while creating decoration type:', error);
        }
        
        try {
            const ranges = lines.map(line => document.lineAt(line).range);
            //debugLog(`Ranges: ${ranges}`);
            editor.setDecorations(decorationType, ranges);
        } catch(error) {
            console.error('Error while setting decorations:', error);
        }
    }
}

export function highlightLine(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('git-highlighter.highlightLine', () => {
        console.log("COMMAND: highlight:line called");
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const line = editor.selection.active.line;
            const uri = editor.document.uri.toString();
        
            if (!highlights[uri]) {
                highlights[uri] = [];
            }

            const index = highlights[uri].indexOf(line);
            if (index === -1) {
                highlights[uri].push(line);
            } else {
                highlights[uri].splice(index, 1);
            }

            applyHighlights(editor.document);
        }
    });
    console.log("highlight:line registered");

    context.subscriptions.push(disposable);
}

export function highlightCommits(context: vscode.ExtensionContext, diffLog: {[uri: string]: number[]}) {

    //TODO: Try to centralize gitHelper await here to break up sync
    debugLog("Registering test command");
    let disposable = vscode.commands.registerCommand('git-highlighter.highlightCommits', () => {
        try {
            //vscode.window.showInformationMessage("Git Highlighter Activated!");
            //jsonhighlights = diffLog; // Run the diff function and write to highlights.json
            loadHighlights(diffLog); // Reload the highlights
            for (const editor of vscode.window.visibleTextEditors) {
                applyHighlights(editor.document); // Apply the highlights to all open editors
            }
        } catch (error) {
            vscode.window.showErrorMessage("diff-highlighter failed to run. Please check the console for more information.");
            exit(1);
        }
    });

    context.subscriptions.push(disposable);
}

export function showCurrentChanges(context: vscode.ExtensionContext) {
    
}