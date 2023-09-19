import * as vscode from 'vscode';
import * as _ from 'lodash';
import { InfoManager as ms } from './infoManager';


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

    loadHighlights(newHighlights: {[fileName: string]: number[]}) {
        for (const fileName in newHighlights) {
            if (newHighlights.hasOwnProperty(fileName)) {
                const lines = newHighlights[fileName];
                // Clear existing highlights for this file
                this.highlights[fileName] = [];
                this.highlights[fileName].push(...lines);
            }
        }
    }

    loadFile(fileName: string, lines:number[]) {
        //console.log(`Loading file: ${fileName}`);
        this.highlights[fileName] = lines;
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
            const file = document.fileName;
            
            const lines =this.highlights[file] || [];
            //console.log(`applying highlights to: ${uri}`);
            //console.log(`Lines: ${lines}`);
            const color = vscode.workspace.getConfiguration('GitVision').get('highlightColor');
            //ms.debugLog(`Color: ${color}`);

            try {
                this.decorationType.dispose(); 
                this.decorationType = vscode.window.createTextEditorDecorationType({
                    backgroundColor: color as string,
                    isWholeLine: true,
                    overviewRulerColor: 'rgb(79, 190, 255)',
                    overviewRulerLane: vscode.OverviewRulerLane.Full,
                    
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
            const file = editor.document.fileName;
        
            if (!this.highlights[file])
                this.highlights[file] = [];

            const index =this.highlights[file].indexOf(line);
            if (index === -1)
                this.highlights[file].push(line);
            else
                this.highlights[file].splice(index, 1);
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
            const file = e.document.fileName;
            //console.log(`onDidChangeTextDocument ${file}`);
            if (!this.highlights[file]) { return; }
            
            this.highlights[file].sort((a, b) => a - b);
            
            for (const change of e.contentChanges) {
                const lineCount = (change.text.match(/\n/g) || []).length;
                if (lineCount > 0) {
                    const line = e.document.lineAt(change.range.start).lineNumber + 1;
                    const i = this.binarySearch(this.highlights[file], line);
                    for (let j = i; j < this.highlights[file].length; j++)
                        this.highlights[file][j] += lineCount;
                } else if (change.range.isSingleLine === false) {
                    const startLine = change.range.start.line;
                    const endLine = change.range.end.line;
                    const linesRemoved = endLine - startLine;
                    const i = this.binarySearch(this.highlights[file], startLine);
                    for (let j = i; j < this.highlights[file].length; j++)
                        this.highlights[file][j] -= Math.min(this.highlights[file][j] - startLine, linesRemoved);
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
            if (array[mid] === target)
                return mid;
            else if (array[mid] < target)
                left = mid + 1;
            else
                right = mid - 1;
        }
        return left;
    }
}