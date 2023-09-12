
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
import { debugLog, DEBUG } from './library';
import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git';
import { CommitListViewProvider, Commit } from './commitView'
export class GitProcessor {
    private workspacePath: string;
    private git: SimpleGit;
    //private gitLsFiles: Promise<string>;
    private gitLogPromise: Promise<Map<string, DefaultLogFields>>;
    private gitLogMap: Map<string, DefaultLogFields>;
    private gitHighlightData: {[uri: string]: number[]};
    gitHighlightFiles: Set<string> = new Set();
    private commitHashSet: Set<string> = new Set();
    private commitList: Commit[] = [];

    private constructor() {
        this.workspacePath = getWorkspacePath();
        this.git = simpleGit(this.workspacePath);
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

    private async getChangedFiles(hash: string): Promise<string[]> {
        let res: string[];
        if (hash === '0000000000000000000000000000000000000000')
        {
            res = (await this.git.raw(['diff','--relative', `HEAD`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
        }
        else {
            res = (await this.git.raw(['diff', '--relative', `${hash}~..${hash}`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
        }

        debugLog(`Changed files for hash: ${hash}: ${res}`);
        return res;
    }

    private async setGitLogMap(): Promise<Map<string, DefaultLogFields>> {
        const log = await this.git.log();
        const map: Map<string, DefaultLogFields> = new Map();
        for (let l of log.all) {
            map.set(l.message, l); //todo, maybe add multiple hashes if unsure of message.
            this.commitList.push(new Commit(l.message, new Date(l.date)));
        }

        const current: DefaultLogFields = {
            hash: '0000000000000000000000000000000000000000',
            date: '',
            message: '',
            author_email: '',
            author_name: '',
            refs: '',
            body: '',
        };
        map.set('Uncommitted changes', current);

        return map;
    }

    //input is a list of commit messages
    private async fillHashAndFileSet(commitList: string[]) {
        //let branches: string[] = getCommitList();
        //commitList = commitList.filter(line => line.trim() !== '');

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

        commitList.forEach(commit => {debugLog(`Commit: ${commit}, ${this.gitLogMap.get(commit)?.hash}`);});

        const filePromises = commitList.map(commit => {
            const hash = this.gitLogMap.get(commit)?.hash;
            if (hash) {
                this.commitHashSet.add(hash);
                return this.getChangedFiles(`${hash}`);
            }
            return Promise.resolve([]);
        });

        //
        const set =  new Set<string>((await Promise.all(filePromises)).flat());
        set.forEach(file => this.gitHighlightFiles.add(file));
        
        if (DEBUG) {
            debugLog(`==Files with changes==`);
            for (let file of this.gitHighlightFiles) {
                debugLog(`${file}`);
            }
            debugLog(`======================`);
        }
        vscode.window.showInformationMessage(`Changes found in ${this.gitHighlightFiles.size} files`);
    }

    //The main function that gets the highlights
    /*
    reliant on...
    @this.commitHashSet
    @this.gitHighlightData
    */
    private async fillGitHighlightData() {

        for (let file of this.gitHighlightFiles) {
            //check for empty file or empty blame file
            if (file.trim() === '') {
                continue;
            }
            //const blameFile: string[] = this.executeCommand(`git blame -l ${file}`).trim().split('\n');
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
        }
    }

    async addCurrentBranch(): Promise<void> {
        let branchCommits = (await this.git.raw(['log','main..HEAD', `--pretty=format:%s`])).split('\n').map(s => s.trim()).filter(Boolean);
        debugLog(`Commits to be added: ${branchCommits}`);
        await this.addCommits(branchCommits);
    }

    async addCommits(commitList: string[]): Promise<void> {
        await this.fillHashAndFileSet(commitList);
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

    getCommitList(): Commit[] {
        return this.commitList;
    }
}