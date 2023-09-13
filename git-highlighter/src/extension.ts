// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CommandProcessor } from './commands';
//import { CommitListViewProvider, Commit } from './commitView';

//let gitObject: GitProcessor;
let commandProcessor: CommandProcessor;

export async function activate(context: vscode.ExtensionContext) {
    
    //Initialize Command Processor
    if (!commandProcessor) {
        commandProcessor = await CommandProcessor.create(context);
    }

    context.subscriptions.push(vscode.commands.registerCommand('gmap.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'gmap');
    }));

    //highlight current line
    commandProcessor.highlightLine(context);

    //show all commits in commit list
    commandProcessor.highlightCommits(context);

    //show all uncommited changes
    commandProcessor.highlightCurrent(context);

    //Show all changes in current branch
    commandProcessor.highlightBranch(context);

    commandProcessor.clearAllHighlights(context);
    
    commandProcessor.collapseAll(context);
    commandProcessor.expandAll(context);
    
    //Display Tree in sidebar view
    commandProcessor.updateTreeFiles(context);

    commandProcessor.addCommit(context);
    commandProcessor.removeCommit(context);
    commandProcessor.hideHighlights(context);
/*
    let disposable = vscode.commands.registerCommand('gmap.openColorPicker', () => {
        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'colorPicker',
            'Color Picker',
            vscode.ViewColumn.One,
            {}
        );
        panel.webview.html = getWebviewContent();
        panel.webview.onDidReceiveMessage(
            message => {
                console.log('Message received: ', message);  // Debug log
                switch (message.command) {
                    case 'colorSelected':
                        console.log(`Color selected: ${message.color}`);
                        vscode.workspace.getConfiguration('gmap').update('highlightColor', message.color, vscode.ConfigurationTarget.Global);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });
    context.subscriptions.push(disposable);
    */
    
}

// This method is called when your extension is deactivated
export function deactivate() {}
/*
function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Color Picker</title>
        </head>
        <body>
            <input type="color" id="colorPicker" onchange="sendColor()">
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function sendColor() {
                    const color = document.getElementById('colorPicker').value;
                    console.log('Color selected in webview: ' + color);
                    vscode.postMessage({
                        command: 'colorSelected',
                        color: color
                    });
                }
            </script>
        </body>
        </html>
    `;
}*/