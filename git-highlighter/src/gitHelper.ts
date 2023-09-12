
/*
Steps:
Every entry needs a commit message
commit message maps to hash
hash is used to get changed files
changed files are used to get line blame
line blame is used to get line numbers

*/

import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { getWorkspacePath, getCommitList } from './library';
import { debugLog, DEBUG } from './library';
import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git';
//import { Commit } from './commitView'

const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

export class GitProcessor {
    private workspacePath: string;
    private git: SimpleGit;
    //private gitLsFiles: Set<string>;
    private gitLogPromise: Promise<Map<string, DefaultLogFields>>;
    private gitLogMap: Map<string, DefaultLogFields>;
    private gitHighlightData: {[uri: string]: number[]};
    private gitHighlightFiles: Set<string> = new Set();
    private commitHashSet: Set<string> = new Set();
    //private commitList: Commit[] = [];
    private commitList: { [key: string]: string } = {};
    private gitignoreContent;
    private ig ;

    private constructor() {
        this.workspacePath = getWorkspacePath();
        this.git = simpleGit(this.workspacePath);
        this.gitignoreContent = fs.readFileSync(path.join(this.workspacePath, '.gitignore')).toString();
        this.ig = ignore().add(this.gitignoreContent);
        //this.gitLsFiles = this.git.raw(['ls-files']);
        this.gitLogPromise = this.setGitLogMap();
        this.gitLogMap = new Map();
        this.gitHighlightData = {};
    }

    static async create() {
        const processor = new GitProcessor();
        await processor.setUp();
        return processor;
    }

    private async setUp()
    {
        // 1. set gitLogMap
        this.gitLogMap = await this.gitLogPromise;
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
            return "";
        }
    }

    private async setGitLogMap(): Promise<Map<string, DefaultLogFields>> {
        try {
            const log = await this.git.log();
            const map: Map<string, DefaultLogFields> = new Map();
            for (let l of log.all) {
                map.set(l.message, l); //todo, maybe add multiple hashes if unsure of message.
                //this.commitList.push(new Commit(l.message, new Date(l.date)));
                this.commitList[l.message] = l.date;
                debugLog(`Commit: ${l.message}, ${l.hash}`);
            }

            const current: DefaultLogFields = {
                hash: '0000000000000000000000000000000000000000',
                date: '', message: '', author_email: '', author_name: '', refs: '', body: '', };
            map.set('Uncommitted changes', current);
            return map;
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting git log`);
            return new Map();
        }
    }
    
    private async getChangedFiles(hash: string): Promise<string[]> {
        try {
            let res: string[];
            if (hash === '0000000000000000000000000000000000000000') {
                res = (await this.git.raw(['diff','--relative', `HEAD`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
            }
            else {
                res = (await this.git.raw(['diff', '--relative', `${hash}~..${hash}`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
            }
            
            // Filter out ignored files
            res = res.filter(file => {
                // Convert to relative path
                const relativePath = path.relative(process.cwd(), file);
                // Return true if the file is NOT ignored
                return !this.ig.ignores(relativePath);
            });
    
            debugLog(`Changed files for hash: ${hash}: ${res}`);
            return res;
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting changed files for hash: ${hash}`);
            return [];
        }
    }

    //input is a list of commit messages
    private async fillHashAndFileSet(commitList: string[]) {

        if (this.gitLogMap.size === 0) {
            debugLog(`No git log found. Please check that you are in a git repository.`);
            vscode.window.showErrorMessage(`No git log found. Please check that you are in a git repository.`);
        }

        if (false) {
            this.gitLogMap.forEach((value, key) => {
                debugLog(`Key: ${key}, Value: ${value.hash}`);
                if (key in commitList) {
                    debugLog(`Key: ${key}, Value: ${value.hash}`);
                }
            });
        }

        const filePromises = commitList.map(commit => {
            const hash = this.gitLogMap.get(commit)?.hash;
            if (hash) {
                this.commitHashSet.add(hash);
                return this.getChangedFiles(`${hash}`);
            }
            return Promise.resolve([]);
        });

        const set =  new Set<string>((await Promise.all(filePromises)).flat());
        debugLog(`Set: ${set}`);
        for (const file of set) { 
            debugLog(`File: ${file}`);
            if (fs.existsSync(path.join(this.workspacePath, file))) {
                debugLog(`File exists: ${file}`);
                this.gitHighlightFiles.add(file);
            }
            else {
                debugLog(`File does not exist: ${file}`);
            }
        }
        //set.forEach(file => this.gitHighlightFiles.add(file));
        
        if (DEBUG) {
            debugLog(`==Files with changes==`);
            for (let file of this.gitHighlightFiles) {
                debugLog(`${file}`);
            }
            debugLog(`======================`);
        }

        //vscode.window.showInformationMessage(`Changes found in ${this.gitHighlightFiles.size} files`);
        if (this.gitHighlightFiles.size > 100) {
            vscode.window.showWarningMessage(`More than 100 files changed. This may take a while to load.`);
        }
    }

    //The main function that gets the highlights
    /*
    reliant on...
    @this.commitHashSet
    @this.gitHighlightData
    */
    private async fillGitHighlightData() {

        //debugLog(`fillGitHighlightData: ${this.gitHighlightFiles}`);
        let errorCount = 0;
        for (let file of this.gitHighlightFiles) {
            debugLog(`finding hash data for file: ${file}`);
            //check for empty file or empty blame file
            if (file.trim() === '') {
                continue;
            }

            try {
                const blameFile: string[] = (await this.git.raw(['blame', `-l`, `${file}`])).split('\n').map(s => s.trim()).filter(Boolean);
                if (blameFile.length === 0) {
                    continue;
                }
                const uri = vscode.Uri.file(path.join(this.workspacePath, file)).toString();
                if (!(uri in this.gitHighlightData)) {
                    this.gitHighlightData[uri] = [];
                }
                for (let lineNumber = 0; lineNumber < blameFile.length; lineNumber++) {
                    let lineHash = blameFile[lineNumber].split(' ')[0].trim();
                    while (lineNumber < blameFile.length && this.commitHashSet.has(lineHash)) {
                        this.gitHighlightData[uri].push(lineNumber);
                        lineNumber++;
                        if (lineNumber < blameFile.length) {
                            lineHash = blameFile[lineNumber].split(' ')[0].trim();
                        }
                    }
                }
                if (DEBUG) {
                    debugLog(`==Highlights for ${file}==`);
                    debugLog(`${this.gitHighlightData}`);
                    debugLog(`${this.gitHighlightData[uri]}`);
                    debugLog(`========================`);
                }
            } catch (error) {
                console.error(`Error getting blame for file: ${file}`);
                vscode.window.showErrorMessage(`Error getting blame for file: ${file}`);
            }
        }
    }

    async addCurrentBranch(): Promise<void> {
        try {
            let branchCommits: string[] = (await this.git.raw(['log','main..HEAD', `--pretty=format:%s`])).split('\n').map(s => s.trim()).filter(Boolean);
            debugLog(`Commits to be added: ${branchCommits}`);
            //await this.addCommits(branchCommits); //TODOFIX
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error getting branch commits`);
        }
    }

    async addCommits(commitList: { [key: string]: string }): Promise<void> {
        //await this.fillHashAndFileSet(commitList);
        let temp: string[] = Object.keys(commitList);
        //for (let commit of Object.values(commitList))) {
        //    temp.push(commit.commitMessage);
        //}
        await this.fillHashAndFileSet(temp);
        await this.fillGitHighlightData();
    }

    getGitHighlightData(): {[uri: string]: number[]} {
        return this.gitHighlightData;
    }

    getHighlightFiles(): Set<string> {
        return this.gitHighlightFiles;
    }

    putHighlightFiles(newFiles: Set<string>): void {
        this.gitHighlightFiles = newFiles;
    }

    clearHighlightData() {
        this.gitHighlightData = {};
        this.gitHighlightFiles = new Set();
        this.commitHashSet = new Set();
    }

    saveState(context: vscode.ExtensionContext) {
        //look into this for maintaining state
        let count = context.globalState.get<number>('count');
        if (count === undefined) {
            count = 0;
        }
        debugLog(`Count is ${count}`);
        context.globalState.update('count', count + 1);
    }

    getCommitList(): { [key: string]: string }  {
        return this.commitList;
    }
}