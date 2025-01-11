import * as vscode from 'vscode';
import * as _ from 'lodash';
import { InfoManager as ms } from './infoManager';
import { Color } from './Color';

/*
Maybe I should make a Commit class

Each commit would have:
- Message
- Hash
- { [file: string]: number[] }
- Color
*/
export class HighlightProcessor {
    private highlights: { [uri: string]: number[] };
    private decorationType: vscode.TextEditorDecorationType;
    private throttledApplyHighlights = _.throttle(this.applyHighlights.bind(this), 300, { leading: false });

    private currentFile: string | undefined;
    private allChangeBlocks: { file: string, block: { start: number, end: number } }[] = [];
    private currentBlockIndex: number = -1;

    constructor() {
        this.highlights = {};
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'transparent',
            isWholeLine: true,
        });

        const realtimeHighlighting = vscode.workspace.getConfiguration('GitVision').get<boolean>('realtimeHighlighting');
        if (realtimeHighlighting) {
            this.fileWatcher();
        }
    }

    /**
     * Loads multiple highlights for various files.
     * @param newHighlights An object where keys are file paths and values are arrays of line numbers.
     */
    loadHighlights(newHighlights: { [fileName: string]: number[] }) {
        for (const fileName in newHighlights) {
            if (newHighlights.hasOwnProperty(fileName)) {
                const lines = newHighlights[fileName];
                ms.debugLog(`Loading highlights for ${fileName}: ${lines}`);
                this.highlights[fileName] = [...lines].sort((a, b) => a - b);
            }
        }
        this.regenerateAllChangeBlocks();
    }

    /**
     * Loads highlights for a single file.
     * @param fileName The path of the file.
     * @param lines An array of line numbers to highlight.
     */
    loadFile(fileName: string, lines: number[]) {
        ms.debugLog(`Loading file: ${fileName}`);
        this.highlights[fileName] = [...lines].sort((a, b) => a - b);
        this.regenerateAllChangeBlocks();
    }

    /**
     * Clears highlights from a specific document.
     * @param document The VSCode text document.
     */
    clearHighlights(document: vscode.TextDocument) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            // Clear decorations by setting an empty array
            editor.setDecorations(this.decorationType, []);
        }
    }

    /**
     * Applies highlights to a specific document.
     * @param document The VSCode text document.
     */
    applyHighlights(document: vscode.TextDocument) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            let file = document.fileName;
            let lines: number[] = [];
    
            if (process.platform === 'win32') {
                // Normalize the path to use forward slashes
                file = file.replace(/\\/g, '/');
                const lowerFile = file.toLowerCase();
                const matchingKey = Object.keys(this.highlights).find(key => 
                    key.toLowerCase().replace(/\\/g, '/') === lowerFile
                );
                if (matchingKey) {
                    lines = this.highlights[matchingKey];
                    ms.debugLog(`File path: ${file}`);
                    ms.debugLog(`Matching key found: ${matchingKey}`);
                    ms.debugLog(`Number of lines to highlight: ${lines.length}`);
                    ms.debugLog(`Decoration type: ${JSON.stringify(this.decorationType)}`);
                }
            } else {
                lines = this.highlights[file] || [];
            }


            const highlightColor = vscode.workspace.getConfiguration('GitVision').get<string>('highlightColor') ?? 'rgba(34, 89, 178, 0.4)';
            const color: Color = new Color(highlightColor);

            try {
                this.decorationType.dispose();
                this.decorationType = vscode.window.createTextEditorDecorationType({
                    backgroundColor: color.toString(),
                    isWholeLine: true,
                    overviewRulerColor: color.toStringO(1),
                    overviewRulerLane: vscode.OverviewRulerLane.Full,
                });
            } catch (error) {
                console.error('Error while creating decoration type:', error);
            }

            try {
                const ranges = lines.map(line => {
                    if (line < 0 || line >= document.lineCount) {
                        ms.debugLog(`Invalid line number ${line} for file ${file}`);
                        return new vscode.Range(0, 0, 0, 0);
                    }
                    const docLine = document.lineAt(line).range;
                    return new vscode.Range(docLine.start, docLine.end);
                });
                editor.setDecorations(this.decorationType, ranges);
            } catch (error) {
                console.error('Error while setting decorations:', error);
            }
        }
    }

    /**
     * Toggles highlight on the current line in the active editor.
     */
    highlightLine() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const line = editor.selection.active.line;
            const file = editor.document.fileName;

            if (!this.highlights[file]) {
                this.highlights[file] = [];
            }

            const index = this.highlights[file].indexOf(line);
            if (index === -1) {
                this.highlights[file].push(line);
            } else {
                this.highlights[file].splice(index, 1);
            }

            // Sort the lines after modification
            this.highlights[file].sort((a, b) => a - b);
            this.applyHighlights(editor.document);
        }
    }

    /**
     * Clears all highlights from all files.
     */
    clearAllHighlights() {
        ms.debugLog('Clearing all highlights');
        this.highlights = {};
        const editors = vscode.window.visibleTextEditors;
        for (const editor of editors) {
            this.clearHighlights(editor.document);
        }
        this.allChangeBlocks = [];
        this.currentBlockIndex = -1;
    }

    /**
     * Watches for changes in text documents to adjust highlight lines accordingly.
     */
    fileWatcher() {
        vscode.workspace.onDidChangeTextDocument(e => {
            const file = e.document.fileName;
            if (!this.highlights[file]) { return; }

            this.highlights[file].sort((a, b) => a - b);

            for (const change of e.contentChanges) {
                const lineCount = (change.text.match(/\n/g) || []).length;
                if (lineCount > 0) {
                    const line = e.document.lineAt(change.range.start).lineNumber + 1;
                    const i = this.binarySearch(this.highlights[file], line);
                    for (let j = i; j < this.highlights[file].length; j++) {
                        this.highlights[file][j] += lineCount;
                    }
                } else if (!change.range.isSingleLine) {
                    const startLine = change.range.start.line;
                    const endLine = change.range.end.line;
                    const linesRemoved = endLine - startLine;
                    const i = this.binarySearch(this.highlights[file], startLine);
                    for (let j = i; j < this.highlights[file].length; j++) {
                        // Prevent negative line numbers
                        this.highlights[file][j] = Math.max(this.highlights[file][j] - linesRemoved, startLine);
                    }
                }
            }

            this.throttledApplyHighlights(e.document);
        });
    }

    /**
     * Performs a binary search to find the insertion index for a target in a sorted array.
     * @param array The sorted array to search within.
     * @param target The target value to find.
     * @returns The index where the target should be inserted.
     */
    private binarySearch(array: number[], target: number): number {
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
    
    private normalizePath(filePath: string): string {
        // Need for windows otherwise the paths get stuck
        if (process.platform === 'win32') {
            return filePath.replace(/\\/g, '/').toLowerCase();
        }
        return filePath;
    }

    private getCurrentPosition(): { file: string, line: number } | undefined {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const file = this.normalizePath(editor.document.fileName);
            ms.debugLog(`Current editor file (normalized): ${file}`);
            return {
                file: file,
                line: editor.selection.active.line
            };
        }
        return undefined;
    }

    private regenerateAllChangeBlocks() {
        this.allChangeBlocks = [];
        const files = Object.keys(this.highlights).sort((a, b) => 
            this.normalizePath(a).localeCompare(this.normalizePath(b))
        );
        
        for (const file of files) {
            const blocks = this.getHighlightBlocks(this.highlights[file]);
            for (const block of blocks) {
                this.allChangeBlocks.push({ 
                    file: this.normalizePath(file), 
                    block 
                });
            }
        }
        
        this.allChangeBlocks.sort((a, b) => 
            a.file.localeCompare(b.file) || a.block.start - b.block.start
        );
        
        ms.debugLog(`Regenerated change blocks: ${JSON.stringify(this.allChangeBlocks)}`);
    }
    
    private async openFileAndJumpToLine(file: string, line: number) {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const editor = await vscode.window.showTextDocument(document);
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            this.applyHighlights(document);
            ms.debugLog(`Navigated to ${file} at line ${line}`);
        } catch (error) {
            console.error(`Failed to open file ${file} at line ${line}:`, error);
            ms.debugLog(`Error opening file: ${error}`);
        }
    }
    
    private getHighlightBlocks(highlights: number[]): { start: number, end: number }[] {
        if (!highlights || highlights.length === 0) return [];

        const sortedHighlights = [...highlights].sort((a, b) => a - b);
        const blocks: { start: number, end: number }[] = [];

        let blockStart = sortedHighlights[0];
        let blockEnd = sortedHighlights[0];

        for (let i = 1; i < sortedHighlights.length; i++) {
            if (sortedHighlights[i] === blockEnd + 1) {
                blockEnd = sortedHighlights[i];
            } else {
                blocks.push({ start: blockStart, end: blockEnd });
                blockStart = sortedHighlights[i];
                blockEnd = sortedHighlights[i];
            }
        }

        blocks.push({ start: blockStart, end: blockEnd });
        return blocks;
    }

    jumpToNextChange() {
        if (this.allChangeBlocks.length === 0) {
            this.regenerateAllChangeBlocks();
        }

        if (this.allChangeBlocks.length === 0) {
            vscode.window.showInformationMessage('No highlighted changes available.');
            return;
        }

        const currentPosition = this.getCurrentPosition();
        if (!currentPosition) {
            vscode.window.showInformationMessage('No active text editor.');
            return;
        }

        ms.debugLog(`Current position for next: ${JSON.stringify(currentPosition)}`);
        ms.debugLog(`Number of change blocks: ${this.allChangeBlocks.length}`);

        let nextChangeIndex = this.allChangeBlocks.findIndex(change => 
            change.file.localeCompare(currentPosition.file) > 0 || 
            (change.file === currentPosition.file && change.block.start > currentPosition.line)
        );

        if (nextChangeIndex === -1) {
            nextChangeIndex = 0;
        }

        const nextChange = this.allChangeBlocks[nextChangeIndex];
        this.currentBlockIndex = nextChangeIndex;
        
        const originalFilePath = Object.keys(this.highlights).find(
            file => this.normalizePath(file) === nextChange.file
        ) || nextChange.file;
        
        this.openFileAndJumpToLine(originalFilePath, nextChange.block.start);
    }

    jumpToPrevChange() {
        if (this.allChangeBlocks.length === 0) {
            this.regenerateAllChangeBlocks();
        }

        if (this.allChangeBlocks.length === 0) {
            vscode.window.showInformationMessage('No highlighted changes available.');
            return;
        }

        const currentPosition = this.getCurrentPosition();
        if (!currentPosition) {
            vscode.window.showInformationMessage('No active text editor.');
            return;
        }

        ms.debugLog(`Current position for prev: ${JSON.stringify(currentPosition)}`);
        ms.debugLog(`Number of change blocks: ${this.allChangeBlocks.length}`);

        let prevChangeIndex = this.allChangeBlocks.findIndex(change => 
            change.file.localeCompare(currentPosition.file) >= 0 && 
            change.block.start >= currentPosition.line
        );

        if (prevChangeIndex <= 0) {
            prevChangeIndex = this.allChangeBlocks.length - 1;
        } else {
            prevChangeIndex--;
        }

        const prevChange = this.allChangeBlocks[prevChangeIndex];
        this.currentBlockIndex = prevChangeIndex;

        // Use os specific path
        const originalFilePath = Object.keys(this.highlights).find(
            file => this.normalizePath(file) === prevChange.file
        ) || prevChange.file;

        this.openFileAndJumpToLine(originalFilePath, prevChange.block.start);
    }

}
