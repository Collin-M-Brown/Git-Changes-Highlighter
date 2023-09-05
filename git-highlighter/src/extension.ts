// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import compileDiffLog from './gitHelper';
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
    console.log("Starting loadHighlights function");
    const filePath = path.join(__dirname, 'highlights.json');
    console.log(`File path: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
        console.log("File exists, reading file");
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            if (data.trim() !== "") {
                highlights = JSON.parse(data);
            } else {
                console.log("File is empty, not attempting to parse");
            }
        } catch (error) {
            console.error("Error reading file or parsing JSON:", error);
        }
    } else {
        console.log("File does not exist");
    }
    console.log("Finished loadHighlights function");
}

function applyHighlights(document: vscode.TextDocument) {
    console.log("Applying highlights in applyHighlights"); 
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        const uri = document.uri.toString();
        console.log(`URI: ${uri}`);
        const lines = highlights[uri] || [];
        console.log(`Lines: ${lines}`);
        const color = vscode.workspace.getConfiguration('git-highlighter').get('highlightColor');
        console.log(`Color: ${color}`);

        try {
            decorationType.dispose(); 
            decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: color as string,
                isWholeLine: true,
            });
            console.log('Decoration type created successfully');
        } catch(error) {
            console.error('Error while creating decoration type:', error);
        }
        
        try {
            const ranges = lines.map(line => document.lineAt(line).range);
            console.log(`Ranges: ${ranges}`);
            editor.setDecorations(decorationType, ranges);
        } catch(error) {
            console.error('Error while setting decorations:', error);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Load the highlights from the JSON file
    console.log("Loading highlights");
    loadHighlights();
    console.log("applying highlights");
    // Apply the highlights to all currently visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
        applyHighlights(editor.document);
    });
    
    console.log("didchangevisible? highlights");
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

    console.log("Registering test command");
    let testCommandDisposable = vscode.commands.registerCommand('git-highlighter.testDiff', () => {
        try {
            console.log("Starting diff");
            vscode.window.showInformationMessage("Diff started");
            compileDiffLog(); // Run the diff function and write to highlights.json
            loadHighlights(); // Reload the highlights
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
