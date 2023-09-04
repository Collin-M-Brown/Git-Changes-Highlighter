// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { compileDiffLog } from './gitHelper';
import { exit } from 'process';
import { exec } from 'child_process';

let highlights: { [uri: string]: number[] } = {};
let decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'transparent', // Placeholder color
    isWholeLine: true,
});

function saveHighlights() {
    const filePath = path.join(__dirname, 'highlights.json');
    fs.writeFileSync(filePath, JSON.stringify(highlights));
}

function loadHighlights() {
    const filePath = path.join(__dirname, 'git_highlighter.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const highlightData = JSON.parse(data);
        highlights = {}; // Clear the old highlights
        for (const file of highlightData.files) {
            let fullPath;
            if (vscode.workspace.workspaceFolders) {
                fullPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, file.path);
            } else {
                fullPath = file.path;
            }
            const uri = vscode.Uri.file(fullPath).toString();
            highlights[uri] = [];

            // Iterate over the bookmarks
            for (let i = 0; i < file.bookmarks.length; i++) {
                // If this bookmark and the next one have labels, highlight all lines between them
                if (file.bookmarks[i].label && file.bookmarks[i + 1]?.label) {
                    for (let line = file.bookmarks[i].line; line <= file.bookmarks[i + 1].line; line++) {
                        highlights[uri].push(line);
                    }
                // Otherwise, just highlight the line of this bookmark
                } else {
                    highlights[uri].push(file.bookmarks[i].line);
                }
            }
        }
    }
}

function applyHighlights(document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        const uri = document.uri.toString();
        const lines = highlights[uri] || [];
        const color = vscode.workspace.getConfiguration('git-highlighter').get('highlightColor');
        decorationType.dispose(); // Dispose the old decorationType
        decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: color as string,
            isWholeLine: true,
        });
        const ranges = lines.map(line => document.lineAt(line).range);
        editor.setDecorations(decorationType, ranges);
    }
}
export function activate(context: vscode.ExtensionContext) {
    // Load the highlights from the JSON file
    loadHighlights();

    // Apply the highlights to all currently visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
        applyHighlights(editor.document);
    });
    
    // Apply the highlights to any editor that becomes visible
    vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
            applyHighlights(editor.document);
        }
    });
    let disposable = vscode.commands.registerCommand('git-highlighter.toggleHighlight', () => {
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
            saveHighlights();
        }
    });

    let testCommandDisposable = vscode.commands.registerCommand('git-highlighter.testDiff', () => {
        try {
            vscode.window.showInformationMessage("Diff started");
            compileDiffLog(); // Run the diff function
            loadHighlights(); // Load the highlights from the created JSON file
            for (const editor of vscode.window.visibleTextEditors) {
                applyHighlights(editor.document); // Apply the highlights to all open editors
            }
        } catch (error) {
            vscode.window.showErrorMessage("Diff failed");
            exit(1);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(testCommandDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
