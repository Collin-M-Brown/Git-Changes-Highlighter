/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.executeCommand = exports.getWorkspacePath = void 0;
const vscode = __webpack_require__(1);
const fs = __webpack_require__(3);
const path = __webpack_require__(4);
const child_process_1 = __webpack_require__(5);
let highlights = {};
const workspacePath = getWorkspacePath();
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
        const output = (0, child_process_1.execSync)(`cd ${workspacePath} && ${command}`);
        const outputString = output.toString();
        console.log(`Completed for command "${command}": ${outputString.length}`);
        return outputString;
    }
    catch (error) {
        console.error(`Error executing command "${command}":`, error); //seems to be trigged by deleted file that has blame in it...
        //process.exit(1);
        return "";
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
    console.log(path.join(workspacePath, '.vscode/CommitList'));
    let branches = fs.readFileSync(path.join(workspacePath, '.vscode/CommitList'), 'utf8').split('\n');
    //let branches = fs.readFileSync(path.join(__dirname, 'FileList'), 'utf8').split('\n');
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
    const highlights = {};
    for (let file of files) {
        if (file.trim() === '') {
            continue;
        }
        const uri = vscode.Uri.file(path.join(workspacePath, file)).toString();
        highlights[uri] = [];
        const blame = executeCommand(`git blame -l ${file}`).trim().split('\n');
        if (blame.length === 0) {
            continue;
        }
        let index = 0;
        while (index < blame.length) {
            const line = blame[index].split(' ')[0].trim();
            if (commitHash.includes(line)) {
                if (index + 1 < blame.length && commitHash.includes(blame[index + 1].split(' ')[0])) {
                    index++;
                    while (index + 1 < blame.length && commitHash.includes(blame[index + 1].split(' ')[0])) {
                        highlights[uri].push(index);
                        index++;
                    }
                    highlights[uri].push(index);
                }
                else {
                    highlights[uri].push(index);
                }
            }
            index++;
        }
    }
    const json = JSON.stringify(highlights, null, 4);
    //fs.writeFileSync(path.join(__dirname, 'highlights.json'), json, 'utf8');
    return json;
}
exports["default"] = compileDiffLog;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("process");

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
const gitHelper_1 = __webpack_require__(2);
const process_1 = __webpack_require__(6);
let highlights = {};
let decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'transparent',
    isWholeLine: true,
});
//function saveHighlights() {
//    const filePath = path.join(__dirname, 'highlights.json');
//    fs.writeFileSync(filePath, JSON.stringify(highlights));
//}
let jsonhighlights = "";
function loadHighlights() {
    //console.log("Starting loadHighlights function");
    //const filePath = path.join(__dirname, 'highlights.json');
    //console.log(`File path: ${filePath}`);
    if (jsonhighlights.trim() !== "") {
        highlights = JSON.parse(jsonhighlights);
    }
    else {
        console.log("File is empty, not attempting to parse");
    }
}
function applyHighlights(document) {
    console.log("Applying highlights in applyHighlights");
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        const uri = document.uri.toString();
        console.log(`URI: ${uri}`);
        const lines = highlights[uri] || [];
        console.log(`Lines: ${lines}`);
        const color = vscode.workspace.getConfiguration('git-highlighter').get('highlightColor');
        console.log(`Color: ${color}`);
        try {
            decorationType.dispose();
            decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: color,
                isWholeLine: true,
            });
            console.log('Decoration type created successfully');
        }
        catch (error) {
            console.error('Error while creating decoration type:', error);
        }
        try {
            const ranges = lines.map(line => document.lineAt(line).range);
            console.log(`Ranges: ${ranges}`);
            editor.setDecorations(decorationType, ranges);
        }
        catch (error) {
            console.error('Error while setting decorations:', error);
        }
    }
}
function activate(context) {
    // Load the highlights from the JSON file
    console.log("Loading highlights");
    loadHighlights();
    console.log("applying highlights");
    // Apply the highlights to all currently visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
        applyHighlights(editor.document);
    });
    console.log("didchangevisible? highlights");
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
            //saveHighlights();
        }
    });
    console.log("Registering test command");
    let testCommandDisposable = vscode.commands.registerCommand('git-highlighter.testDiff', () => {
        try {
            console.log("Starting diff");
            vscode.window.showInformationMessage("Diff started");
            jsonhighlights = (0, gitHelper_1.default)(); // Run the diff function and write to highlights.json
            loadHighlights(); // Reload the highlights
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