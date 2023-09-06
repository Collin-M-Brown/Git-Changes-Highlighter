// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debugLog } from './library';
import { highlightCommits, highlightLine, applyHighlights } from './commands';

//function saveHighlights() {
//    const filePath = path.join(__dirname, 'highlights.json');
//    fs.writeFileSync(filePath, JSON.stringify(highlights));
//}


export function activate(context: vscode.ExtensionContext) {
        
    // Check if editor window has changed and load highlights if it has
    // Apply the highlights to any editor that becomes visible
    vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
            applyHighlights(editor.document);
        }
    });

    // Register the commands
    highlightLine(context);
    highlightCommits(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
