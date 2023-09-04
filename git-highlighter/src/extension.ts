// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { executeCommand, diff, createBookmark } from './gitHelper';

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
    const filePath = path.join(__dirname, 'highlights.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        highlights = JSON.parse(data);
    }
}

function applyHighlights(document: vscode.TextDocument) {
    const editor = vscode.window.activeTextEditor;
    if (editor && document === editor.document) {
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

    loadHighlights();

    vscode.workspace.onDidOpenTextDocument((document) => {
        applyHighlights(document);
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
        applyHighlights(document);
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

    context.subscriptions.push(disposable);
}
// This method is called when your extension is deactivated
export function deactivate() {}
