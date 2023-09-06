// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debugLog } from './library';
import { highlightCommits, highlightLine, applyHighlights } from './commands';

//function saveHighlights() {
//    const filePath = path.join(__dirname, 'highlights.json');
//    fs.writeFileSync(filePath, JSON.stringify(highlights));
//}

export class YourDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (element) {
            // If element is defined, return its children
            return Promise.resolve([
                // Your code here
            ]);
        } else {
            // If element is undefined, return the root nodes of the tree
            return Promise.resolve([
                new vscode.TreeItem('Item 1'),
                new vscode.TreeItem('Item 2')
            ]);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Check if editor window has changed and load highlights if it has
    // Apply the highlights to any editor that becomes visible
    vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
            applyHighlights(editor.document);
        }
    });
    //vscode.window.showInformationMessage("git-highlighter: activated.");

    //TODO: add file watcher to update
    // Register the commands

    //git-highlighter: Highlight Line
    highlightLine(context);

    //git-highlighter: Highlight Commits
    highlightCommits(context);

    const yourDataProvider = new YourDataProvider();
    vscode.window.registerTreeDataProvider('yourView', yourDataProvider);
}

// This method is called when your extension is deactivated
export function deactivate() {}
