/*
Code flow: 
                          -> highlight.ts 
extension.ts->commands.ts -> commitView.ts/fileTree.ts
                          -> gitHelper.ts
*/
import * as vscode from 'vscode';
import { CommandProcessor } from './commands';

let commandProcessor: CommandProcessor;

export async function activate(context: vscode.ExtensionContext) {
    
    //Initialize Command Processor
    if (!commandProcessor) {
        commandProcessor = await CommandProcessor.create(context);
    }
    context.subscriptions.push(vscode.commands.registerCommand('GitVision.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'GitVision');
    }));

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

/*
    let disposable = vscode.commands.registerCommand('GitVision.openColorPicker', () => {
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
                        vscode.workspace.getConfiguration('GitVision').update('highlightColor', message.color, vscode.ConfigurationTarget.Global);
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