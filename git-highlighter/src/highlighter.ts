import * as vscode from 'vscode';
import { debugLog, DEBUG } from './library';
import * as _ from 'lodash';
export class HighlightProcessor {
    private highlights: { [uri: string]: number[] };
    private decorationType:vscode.TextEditorDecorationType;
    private throttledApplyHighlights = _.throttle(this.applyHighlights, 300, {leading: false});

    constructor() {
        this.highlights = {};
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'transparent',
            isWholeLine: true,
        });
        //console.log(vscode.workspace.getConfiguration('GitVision').get('realtimeHighlighting'));
        //if (vscode.workspace.getConfiguration('GitVision').get('realtimeHighlighting'))
        this.fileWatcher();
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

    loadFile(uri:string, lines:number[]) {
        console.log(`Loading file: ${uri}`);
        this.highlights[uri] = lines;
    }

    clearHighlights(document: vscode.TextDocument) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {//todo try catch
            const lines = [] || [];
            this.decorationType.dispose();
            const ranges = [] || [];
            editor.setDecorations(this.decorationType, ranges);
        }
    }

    //TODO Re parse git blame...
    applyHighlights(document: vscode.TextDocument) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            const uri = document.uri.toString();
            
            const lines =this.highlights[uri] || [];
            //console.log(`applying highlights to: ${uri}`);
            //console.log(`Lines: ${lines}`);
            const color = vscode.workspace.getConfiguration('GitVision').get('highlightColor');
            //debugLog(`Color: ${color}`);

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
        this.clearHighlights(vscode.window.activeTextEditor?.document as vscode.TextDocument);
    }

    fileWatcher() {
        vscode.workspace.onDidChangeTextDocument(e => {
            if (!vscode.workspace.getConfiguration('GitVision').get('enableRealtimeHighlighting'))
                return;
            const uri = e.document.uri.toString();
            if (!this.highlights[uri]) { return; }
            
            this.highlights[uri].sort((a, b) => a - b);
            
            for (const change of e.contentChanges) {
                const lineCount = (change.text.match(/\n/g) || []).length;
                if (lineCount > 0) {
                    const line = e.document.lineAt(change.range.start).lineNumber + 1;
                    const i = this.binarySearch(this.highlights[uri], line);
                    for (let j = i; j < this.highlights[uri].length; j++) {
                        this.highlights[uri][j] += lineCount;
                    }
                } else if (change.range.isSingleLine === false) {
                    const startLine = change.range.start.line;
                    const endLine = change.range.end.line;
                    const linesRemoved = endLine - startLine;
                    const i = this.binarySearch(this.highlights[uri], startLine);
                    for (let j = i; j < this.highlights[uri].length; j++) {
                        this.highlights[uri][j] -= Math.min(this.highlights[uri][j] - startLine, linesRemoved);
                    }
                }
            }
    
            this.throttledApplyHighlights(e.document);
        });
    }
    
    private binarySearch(array:any, target: any) {
        let left = 0;
        let right = array.length - 1;
        while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);
            if (array[mid] === target) {
                return mid;
            } else if (array[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return left;
    }
}