let test=1;
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
    private gitHighlightData: {[uri: string]: number[]};
    private gitHighlightFiles: Set<string> = new Set();
    private commitHashSet: Set<string> = new Set();

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
        //2. need to set all the commit hashes
        await this.fillHashAndFileSet(getCommitList());
        this.compileDiffLog();
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
        if (hash === '0000000000000000000000000000000000000000')
        {
            return (await this.git.raw(['diff','--relative', `HEAD`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
        }
        let files = (await this.git.raw(['diff', '--relative', `${hash}~..${hash}`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
        return files;
    }

    private async setGitLogMap(): Promise<Map<string, DefaultLogFields>> {
        const log = await this.git.log();
        const map: Map<string, DefaultLogFields> = new Map();
        for (let l of log.all) {
            map.set(l.message, l); //todo, maybe add multiple hashes if unsure of message.
        }

        const current: DefaultLogFields = {
            hash: '0000000000000000000000000000000000000000',
            date: '', // Placeholder value
            message: '', // Placeholder value
            author_email: '', // Placeholder value
            author_name: '', // Placeholder value
            refs: '', // Added missing property
            body: '', // Added missing property
        };
        map.set('Uncommitted changes', current);

        return map;
    }

    //input is a list of commit messages
    private async fillHashAndFileSet(commitList: string[]) {
        //let branches: string[] = getCommitList();
        //commitList = commitList.filter(line => line.trim() !== '');

        debugLog(`gitLogMap finished`);
        debugLog(`branches: ${commitList}`);

        const filePromises = commitList.map(commit => {
            const hash = this.gitLogMap.get(commit)?.hash;
            if (hash) {
                this.commitHashSet.add(hash);
                return this.getChangedFiles(`${hash}`);
            }
            return Promise.resolve([]);
        });
        
        this.gitHighlightFiles = new Set<string>((await Promise.all(filePromises)).flat());
        vscode.window.showInformationMessage(`Changes found in ${this.gitHighlightFiles.size} files`);
    }

    //The main function that gets the highlights
    /*
    reliant on...
    @this.commitHashSet
    @this.gitHighlightData
    */
    private compileDiffLog() {
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
            this.gitHighlightData[uri] = [];
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
        }
    }

    addCommits(commitList: string[]): void {
        this.fillHashAndFileSet(commitList);
        this.compileDiffLog();
    }

    getJsonHighlights(): {[uri: string]: number[]} {
        return this.gitHighlightData;
    }

    getHighlightFiles(): Set<string> {
        return this.gitHighlightFiles;
    }
}