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
    context.subscriptions.push(disposable);
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