import * as vscode from 'vscode';
import { exit } from 'process';
import { debugLog } from './library';
import { GitProcessor } from './gitHelper';
import { FileDataProvider } from './fileTree';
//import { compileDiffLog } from './gitHelper';

/*
Example format ofthis.highlights.json:
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

export class CommandProcessor {
    //let jsonhighlights: string;
    private highlights: { [uri: string]: number[] };
    private decorationType:vscode.TextEditorDecorationType;
    private gitObject!: GitProcessor;

    private constructor() {
        this.highlights = {};
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'transparent',
            isWholeLine: true,
        });
    }

    static async create() {
        const commandProcessor = new CommandProcessor();
        commandProcessor.gitObject = await GitProcessor.create();
        return commandProcessor;
    }

    private async setUp() {
    
    }

    private loadHighlights(newHighlights: {[uri: string]: number[]}) {
        for (const uri in newHighlights) {
            if (newHighlights.hasOwnProperty(uri)) {
                const lines = newHighlights[uri];
                // Clear existing highlights for this file
                this.highlights[uri] = [];
                this.highlights[uri].push(...lines);
            }
        }
    }

    private clearHighlights() {
        // Clear decorations in all visible text editors
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.decorationType, []);
        }
    }

    applyHighlights(document: vscode.TextDocument) {
        debugLog("Applyingthis.highlights in applyHighlights");
        this.clearHighlights();
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            const uri = document.uri.toString();
            const lines =this.highlights[uri] || [];
            debugLog(`Lines: ${lines}`);
            const color = vscode.workspace.getConfiguration('git-highlighter').get('highlightColor');

            try {
                this.decorationType.dispose(); 
                this.decorationType = vscode.window.createTextEditorDecorationType({
                    backgroundColor: color as string,
                    isWholeLine: true,
                });
            } catch(error) {
                console.error('Error while creating decoration type:', error);
            }
            
            try {
                const ranges = lines.map(line => document.lineAt(line).range);
                //debugLog(`Ranges: ${ranges}`);
                editor.setDecorations(this.decorationType, ranges);
            } catch(error) {
                console.error('Error while setting decorations:', error);
            }
        }
    }

    highlightLine(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('git-highlighter.highlightLine', () => {
            console.log("COMMAND: highlight:line called");
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const line = editor.selection.active.line;
                const uri = editor.document.uri.toString();
            
                if (!this.highlights[uri]) {
                   this.highlights[uri] = [];
                }

                const index =this.highlights[uri].indexOf(line);
                if (index === -1) {
                   this.highlights[uri].push(line);
                } else {
                   this.highlights[uri].splice(index, 1);
                }

                this.applyHighlights(editor.document);
            }
        });
        console.log("highlight:line registered");

        context.subscriptions.push(disposable);
    }

    highlightCommits(context: vscode.ExtensionContext) {
        debugLog("Registering test command");
        let disposable = vscode.commands.registerCommand('git-highlighter.highlightCommits', () => {
            try {
                //vscode.window.showInformationMessage("Git Highlighter Activated!");
                //jsonhighlights = diffLog; // Run the diff and write tothis.highlights.json
                this.loadHighlights(this.gitObject.getJsonHighlights()); // Reload thethis.highlights
                for (const editor of vscode.window.visibleTextEditors) {
                    this.applyHighlights(editor.document); // Apply thethis.highlights to all open editors
                }
            } catch (error) {
                vscode.window.showErrorMessage("diff-highlighter failed to run. Please check the console for more information.");
                exit(1);
            }
        });
        context.subscriptions.push(disposable);
    }

    highlightCurrent(context: vscode.ExtensionContext) {
            debugLog("Registering current command");
            let disposable = vscode.commands.registerCommand('git-highlighter.highlightCurrent', () => {
                try {
                    //vscode.window.showInformationMessage("Git Highlighter Activated!");
                    //jsonhighlights = diffLog; // Run the diff and write tothis.highlights.json
                    this.gitObject.addCommits(["Uncommitted changes"]);
                    this.loadHighlights(this.gitObject.getJsonHighlights()); // Reload thethis.highlights
                    for (const editor of vscode.window.visibleTextEditors) {
                        this.applyHighlights(editor.document); // Apply thethis.highlights to all open editors
                    }
                } catch (error) {
                    vscode.window.showErrorMessage("diff-highlighter failed to run. Please check the console for more information.");
                    exit(1);
                }
            });
        
            context.subscriptions.push(disposable);
    }

    treeView(context: vscode.ExtensionContext) {
        //TreeView
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders !== undefined) {
            const rootPath = workspaceFolders[0].uri.fsPath;
            const fileDataProvider = new FileDataProvider(rootPath, this.gitObject.getHighlightFiles());
            vscode.window.registerTreeDataProvider('gitHighlightsView', fileDataProvider);
        }
    }
}