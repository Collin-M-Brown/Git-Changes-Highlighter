import * as vscode from 'vscode';
import { debugLog, DEBUG } from './library';
export class HighlightProcessor {
    private highlights: { [uri: string]: number[] };
    private decorationType:vscode.TextEditorDecorationType;

    constructor() {
        this.highlights = {};
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'transparent',
            isWholeLine: true,
        });
        vscode.workspace.onDidChangeTextDocument(e => {
            const uri = e.document.uri.toString();
            if (!this.highlights[uri]) { return; }
            for (const change of e.contentChanges) {
                if (change.text.includes('\n')) {
                    // A line was added
                    const line = e.document.lineAt(change.range.start).lineNumber + 1;
                    for (let i = 0; i < this.highlights[uri].length; i++) {
                        if (this.highlights[uri][i] >= line) {
                            this.highlights[uri][i]++;
                        }
                    }
                } else if (change.range.isSingleLine === false) {
                    // A line was removed
                    const line = e.document.lineAt(change.range.start).lineNumber + 1;
                    for (let i = 0; i < this.highlights[uri].length; i++) {
                        if (this.highlights[uri][i] >= line) {
                            this.highlights[uri][i]--;
                        }
                    }
                }
            }
        
            this.applyHighlights(e.document);
        });
    }

    loadHighlights(newHighlights: {[uri: string]: number[]}) {
        for (const uri in newHighlights) {
            if (newHighlights.hasOwnProperty(uri)) {
                const lines = newHighlights[uri];
                // Clear existing highlights for this file
                this.highlights[uri] = [];
                this.highlights[uri].push(...lines);
            }
        }
    }

    clearHighlights() {
        // Clear decorations in all visible text editors
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.decorationType, []);
        }
    }

    //TODO Re parse git blame...
    applyHighlights(document: vscode.TextDocument) {
        //debugLog("Applying this.highlights in applyHighlights");
        this.clearHighlights();
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            const uri = document.uri.toString();
            const lines =this.highlights[uri] || [];
            //console.log(`Switched editor: ${uri}`);
            //console.log(`Lines: ${lines}`);
            const color = vscode.workspace.getConfiguration('GitVision').get('highlightColor');
            debugLog(`Color: ${color}`);

            try {
                this.decorationType.dispose(); 
                this.decorationType = vscode.window.createTextEditorDecorationType({
                    backgroundColor: color as string,
                    isWholeLine: true,
                    //overviewRulerColor: color as string,
                });
            } catch(error) {
                console.error('Error while creating decoration type:', error);
            }
            
            try {
                const ranges = lines.map(line => document.lineAt(line).range);
                editor.setDecorations(this.decorationType, ranges);
            } catch(error) {
                console.error('Error while setting decorations:', error);
            }
        }
    }

    highlightLine() {
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
    }

    clearAllHighlights() {
        this.highlights = {};
        this.clearHighlights();
        this.applyHighlights(vscode.window.activeTextEditor?.document as vscode.TextDocument);
    }

    //clearAllHighlights(context: vscode.ExtensionContext) {
    //    this.highlights = {};
    //    this.applyHighlights(vscode.window.activeTextEditor?.document as vscode.TextDocument);
    //}
}