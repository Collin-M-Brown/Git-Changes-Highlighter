/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.compileDiffLog = exports.executeCommand = exports.getWorkspacePath = void 0;
const vscode = __webpack_require__(1);
const fs = __webpack_require__(2);
const path = __webpack_require__(3);
const child_process_1 = __webpack_require__(6);
let highlights = {};
function getWorkspacePath() {
    if (!vscode.workspace.workspaceFolders) {
        console.error('No workspace folders open');
        return '';
    }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}
exports.getWorkspacePath = getWorkspacePath;
function executeCommand(command) {
    try {
        const workspacePath = getWorkspacePath();
        const output = (0, child_process_1.execSync)(`cd ${workspacePath} && ${command}`);
        const outputString = output.toString();
        console.log(`Completed for command "${command}": ${outputString.length}`);
        return outputString;
    }
    catch (error) {
        console.error(`Error executing command "${command}":`, error);
        process.exit(1);
    }
}
exports.executeCommand = executeCommand;
function createBookmark(line, label) {
    return {
        line: line,
        column: 1,
        label: label,
    };
}
function getHashSet() {
    let branches = fs.readFileSync(path.join(__dirname, 'FileList'), 'utf8').split('\n');
    branches = branches.filter(line => line.trim() !== '');
    const commitHash = [];
    const commitName = {};
    let files = [];
    for (let branch of branches) {
        branch = `"${branch.replace('[', '\\[').replace(']', '\\]')}"`;
        const gitLog = executeCommand(`git log | grep -B 7 -m 1 ${branch}`).split('\n');
        let hash = '';
        if (gitLog.length > 1 && gitLog[1].includes('Merge:')) {
            const diff = gitLog[1].split(' ');
            const f = executeCommand(`git diff ${diff[1]} ${diff[2]} --name-only`).split('\n');
            files = files.concat(f);
            const fullHash = `"commit ${diff[2]}"`;
            hash = executeCommand(`git log | grep ${fullHash}`).split(' ')[1];
        }
        else {
            for (let l of gitLog) {
                if (l.includes('commit')) {
                    hash = l.split(' ')[1];
                    const f = executeCommand(`git diff ${hash}~ ${hash} --name-only`).split('\n');
                    files = files.concat(f);
                }
            }
        }
        commitHash.push(hash.trim());
        commitName[hash] = branch;
    }
    files = Array.from(new Set(files));
    return [commitHash, commitName, files];
}
function compileDiffLog() {
    const [commitHash, commitName, files] = getHashSet();
    const dictionary = { files: [] };
    console.log(`commitHash: ${commitHash}`);
    console.log(`commitHash: ${commitHash[0].length}`);
    for (let file of files) {
        if (file.trim() === '') {
            continue;
        }
        console.log(`parsing blame for file: ${file}`);
        const fileData = {
            path: file,
            bookmarks: []
        };
        const blame = executeCommand(`git blame -l ${file}`).split('\n');
        let index = 0;
        while (index < blame.length) {
            const line = blame[index].split(' ')[0].trim();
            console.log(`Parsing hash from line: ${line}, ${line.length}`);
            if (commitHash.includes(line)) {
                console.log(`hash found: ${line}, ${line.length}`);
                const name = commitName[line];
                if (index + 1 < blame.length && commitHash.includes(blame[index + 1].split(' ')[0])) {
                    fileData.bookmarks.push(createBookmark(index, name));
                    index++;
                    while (index + 1 < blame.length && commitHash.includes(blame[index + 1].split(' ')[0])) {
                        fileData.bookmarks.push(createBookmark(index, "========="));
                        index++;
                    }
                    fileData.bookmarks.push(createBookmark(index, "========="));
                }
                else {
                    fileData.bookmarks.push(createBookmark(index, name));
                }
            }
            index++;
        }
        dictionary.files.push(fileData);
    }
    const json = JSON.stringify(dictionary, null, 4);
    fs.writeFileSync(path.join(__dirname, 'git_highlighter.json'), json, 'utf8');
}
exports.compileDiffLog = compileDiffLog;


/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("process");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __webpack_require__(1);
const fs = __webpack_require__(2);
const path = __webpack_require__(3);
const gitHelper_1 = __webpack_require__(4);
const process_1 = __webpack_require__(5);
let highlights = {};
let decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'transparent',
    isWholeLine: true,
});
function saveHighlights() {
    const filePath = path.join(__dirname, 'highlights.json');
    fs.writeFileSync(filePath, JSON.stringify(highlights));
}
function loadHighlights() {
    const filePath = path.join(__dirname, 'git_highlighter.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const highlightData = JSON.parse(data);
        highlights = {}; // Clear the old highlights
        for (const file of highlightData.files) {
            let fullPath;
            if (vscode.workspace.workspaceFolders) {
                fullPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, file.path);
            }
            else {
                fullPath = file.path;
            }
            const uri = vscode.Uri.file(fullPath).toString();
            highlights[uri] = [];
            // Iterate over the bookmarks
            for (let i = 0; i < file.bookmarks.length; i++) {
                // If this bookmark and the next one have labels, highlight all lines between them
                if (file.bookmarks[i].label && file.bookmarks[i + 1]?.label) {
                    for (let line = file.bookmarks[i].line; line <= file.bookmarks[i + 1].line; line++) {
                        highlights[uri].push(line);
                    }
                    // Otherwise, just highlight the line of this bookmark
                }
                else {
                    highlights[uri].push(file.bookmarks[i].line);
                }
            }
        }
    }
}
function applyHighlights(document) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        const uri = document.uri.toString();
        const lines = highlights[uri] || [];
        const color = vscode.workspace.getConfiguration('git-highlighter').get('highlightColor');
        decorationType.dispose(); // Dispose the old decorationType
        decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
            isWholeLine: true,
        });
        const ranges = lines.map(line => document.lineAt(line).range);
        editor.setDecorations(decorationType, ranges);
    }
}
function activate(context) {
    // Load the highlights from the JSON file
    loadHighlights();
    // Apply the highlights to all currently visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
        applyHighlights(editor.document);
    });
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
            }
            else {
                highlights[uri].splice(index, 1);
            }
            applyHighlights(editor.document);
            saveHighlights();
        }
    });
    let testCommandDisposable = vscode.commands.registerCommand('git-highlighter.testDiff', () => {
        try {
            vscode.window.showInformationMessage("Diff started");
            (0, gitHelper_1.compileDiffLog)(); // Run the diff function
            loadHighlights(); // Load the highlights from the created JSON file
            for (const editor of vscode.window.visibleTextEditors) {
                applyHighlights(editor.document); // Apply the highlights to all open editors
            }
        }
        catch (error) {
            vscode.window.showErrorMessage("Diff failed");
            (0, process_1.exit)(1);
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(testCommandDisposable);
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map