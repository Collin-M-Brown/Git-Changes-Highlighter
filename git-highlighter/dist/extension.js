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
exports.diff = exports.getHashSet = exports.createBookmark = exports.executeCommand = void 0;
const vscode = __webpack_require__(1);
const fs = __webpack_require__(2);
const path = __webpack_require__(3);
const child_process_1 = __webpack_require__(6);
let highlights = {};
function executeCommand(command) {
    try {
        if (!vscode.workspace.workspaceFolders) {
            console.error('No workspace folders open');
            return '';
        }
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
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
exports.createBookmark = createBookmark;
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
exports.getHashSet = getHashSet;
function diff() {
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
exports.diff = diff;


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
    const filePath = path.join(__dirname, 'highlights.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        highlights = JSON.parse(data);
    }
}
function applyHighlights(document) {
    const editor = vscode.window.activeTextEditor;
    if (editor && document === editor.document) {
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
    loadHighlights();
    vscode.workspace.onDidOpenTextDocument((document) => {
        applyHighlights(document);
    });
    vscode.workspace.onDidOpenTextDocument((document) => {
        applyHighlights(document);
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
            (0, gitHelper_1.diff)(); // This will run the diff function when the test command is run
            //executeCommand('pwd');
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