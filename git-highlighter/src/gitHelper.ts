/*
Steps:
Every entry needs a commit message
commit message maps to hash
hash is used to get changed files
changed files are used to get line blame
line blame is used to get line numbers

*/

import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';
import { getWorkspacePath, getCommitList } from './library';
import { debugLog } from './library';
import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git';

export class GitProcessor {
    private workspacePath: string;
    private git: SimpleGit;
    //private gitLsFiles: Promise<string>;
    private gitLogPromise: Promise<Map<string, DefaultLogFields>>;
    private gitLogMap: Map<string, DefaultLogFields>;
    private jsonPromise: Promise<{[uri: string]: number[]}>;
    private gitHighlightFiles: Set<string> = new Set();

    constructor() {
        this.workspacePath = getWorkspacePath();
        this.git = simpleGit(this.workspacePath);
        this.gitLogPromise = this.setGitLogMap();
        this.gitLogMap = new Map();
        this.jsonPromise = this.compileDiffLog();
    }

    private executeCommand(command: string): string {
        try {
            const output = execSync(`cd ${this.workspacePath} && ${command}`);// maybe cd at start
            const outputString = output.toString();
            debugLog(`Completed for command "${command}": ${outputString.length}`);
            return outputString;
        } catch (error) {
            console.error(`Error executing command "${command}":`); //seems to be trigged by deleted file that has blame in it...
            vscode.window.showErrorMessage(`Error executing command: ${command}`);
            //process.exit(1);
            return "";
        }
    }

    private async getChangedFiles(hash: string): Promise<string[]> {
        let files = (await this.git.raw(['diff', '--relative', `${hash}~..${hash}`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
        return files;
    }

    private async setGitLogMap(): Promise<Map<string, DefaultLogFields>> {
        const log = await this.git.log();
        const map: Map<string, DefaultLogFields> = new Map();
        for (let l of log.all) {
            map.set(l.message, l); //todo, maybe add multiple hashes if unsure of message.
        }
        return map;
    }

    private async getHashSet(): Promise<string[]> {
        let branches: string[] = getCommitList();
        branches = branches.filter(line => line.trim() !== '');
        const commitHashSet: string[] = [];
        //const hashToMessageMap: HashToMessageMap = {};
        this.gitLogMap = await this.gitLogPromise;

        debugLog(`gitLogMap finished`);
        debugLog(`branches: ${branches}`);

        const filePromises = branches.map(branch => {
            const hash = this.gitLogMap.get(branch)?.hash;
            if (hash) {
                commitHashSet.push(hash.trim());
                return this.getChangedFiles(`${hash}`);
            }
            return Promise.resolve([]);
        });
        
        this.gitHighlightFiles = new Set<string>((await Promise.all(filePromises)).flat());
        vscode.window.showInformationMessage(`Changes found in ${this.gitHighlightFiles.size} files`);
        return commitHashSet;
    }

    //The main function that gets the highlights
    private async compileDiffLog(): Promise<{[uri: string]: number[]}> {
        const commitHashSet = await this.getHashSet();
        const highlights: { [uri: string]: number[] } = {};

        for (let file of this.gitHighlightFiles) {
            //check for empty file or empty blame file
            if (file.trim() === '') {
                continue;
            }
            const blameFile: string[] = this.executeCommand(`git blame -l ${file}`).trim().split('\n');
            if (blameFile.length === 0) {
                continue;
            }
            const uri = vscode.Uri.file(path.join(this.workspacePath, file)).toString();
            highlights[uri] = [];
            for (let lineNumber = 0; lineNumber < blameFile.length; lineNumber++) {
                let lineHash = blameFile[lineNumber].split(' ')[0].trim();
                while (lineNumber < blameFile.length && commitHashSet.includes(lineHash)) {
                    highlights[uri].push(lineNumber);
                    lineNumber++;
                    if (lineNumber < blameFile.length) {
                        lineHash = blameFile[lineNumber].split(' ')[0].trim();
                    }
                }
            }
        }

        //Store results

        return highlights;
    }

    async getJsonHighlights(): Promise<{[uri: string]: number[]}> {
        return await this.jsonPromise;
    }

    getHighlightFiles(): Set<string> {
        return this.gitHighlightFiles;
    }
}