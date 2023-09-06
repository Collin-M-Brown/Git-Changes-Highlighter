import * as vscode from 'vscode';
import { exit } from 'process';
import { debugLog } from './library';
import compileDiffLog from './gitHelper';
import * as path from 'path';

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
let jsonhighlights = "";
let highlights: { [uri: string]: number[] } = {};

let decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'transparent',
    isWholeLine: true,
});

function loadHighlights() {
    if (jsonhighlights.trim() !== "") {
        highlights = JSON.parse(jsonhighlights);
    } else {
        debugLog("File is empty, not attempting to parse");
    }
}

export function applyHighlights(document: vscode.TextDocument) {
    debugLog("Applying highlights in applyHighlights");
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        const uri = document.uri.toString();
        const lines = highlights[uri] || [];
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
    let disposable = vscode.commands.registerCommand('git-highlighter.highlightLine"', () => {
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

    context.subscriptions.push(disposable);
}

export function highlightCommits(context: vscode.ExtensionContext) {
    debugLog("Registering test command");
    let disposable = vscode.commands.registerCommand('git-highlighter.highlightCommits', () => {
        try {
            debugLog("Starting diff");
            //vscode.window.showInformationMessage("Git Highlighter Activated!");
            jsonhighlights = compileDiffLog(); // Run the diff function and write to highlights.json
            //console.log(jsonhighlights);
            loadHighlights(); // Reload the highlights
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