
/*
File manager manages the state of the current repository.
It will track the git log, .ignore, file blame, and files changed, change count.
This class tends to do most of the heavy lifting and if something is slow it is probably here.

Adding a commit to the watch list:
1. Need commit message.
2. Use commit message to find commit hash.
3. Use commit hash to find files changed using git diff.

git diff notes:
git diff <hash>
    : Finds all the differences between the commit and the current state of the repository.

git diff <hash>~..<hash>
    : Finds all the differences between the hash and its parent commit
    : This one is better for my extension because it will only show files that the hash might appear in
    : There might still be empty diffs because a commits changes could have been overwritten.

git diff <hash>..HEAD
*/

import * as vscode from 'vscode';
import { execSync } from 'child_process';
//import { getWorkspacePath, ms.debugInfo } from './infoManager';
//import { ms.debugLog, ms.DEBUG } from './infoManager';
import simpleGit, { SimpleGit, DefaultLogFields, LogResult } from 'simple-git';
import { GIT_REPO } from './extension';
import { InfoManager as ms } from './infoManager';

const fs = require('fs');
const path = require('path');

export class FileManager {
    private git: SimpleGit;
    private gitLogPromise: Promise<LogResult<DefaultLogFields>>;
    private gitLogMap: Map<string, DefaultLogFields>;
    private gitLsPromise: Promise<string>;
    private gitLsFiles: Set<string> = new Set();
    private gitHighlightData: { [file: string]: number[] };
    private gitHighlightFiles: Set<string> = new Set();
    private commitHashSet: Set<string> = new Set();
    private commitList: { [key: string]: string } = {};
    private fileCounter: Map<string, number> = new Map();
    private headCommit: string = '';

    private constructor() {
        this.git = simpleGit(GIT_REPO);
        this.gitLogPromise = this.git.log();
        this.gitLsPromise = this.git.raw(['ls-files']);
        this.gitLogMap = new Map();
        this.gitHighlightData = {};
    }

    static async create() {
        const fileManager = new FileManager();
        await fileManager.setUp();
        return fileManager;
    }

    private async setUp() {
        this.headCommit = (await this.executeGitCommand(`rev-list --max-parents=0 HEAD`)).trim();
        //this.headCommit = (await this.git.raw(['rev-list', '--max-parents=0', 'HEAD'])).trim();
        this.gitLogMap = this.setgitLogMap((await this.gitLogPromise));
        this.gitLsFiles = new Set<string>((await this.gitLsPromise).split('\n'));
    }
    

    private async executeGitCommand(command: string): Promise<string> {
        try {
            //const path = execSync(`cd ${GIT_REPO} ; git rev-parse --show-toplevel`).toString().trim();
            const outputString = (await this.git.raw(command.split(' '))).trim();
            console.log(`Command: ${command} \nOutput: ${outputString}`);
            return outputString;
        } catch (error) {
            //vscode.window.showErrorMessage(`Error executing command: cd "${GIT_REPO}" && ${command}`);
            if (error instanceof Error)
                ms.debugInfo(`${error.message}`);
            return "";
        }
    }

    private async checkIgnore(filePath: string): Promise<boolean> {
        try {
            const result = await this.git.raw(['check-ignore', filePath]);
            return result.trim() !== '';
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes('not ignored'))
                    return false;
            }
            throw err;
        }
    }

    private setgitLogMap(log: LogResult<DefaultLogFields>): Map<string, DefaultLogFields> {
        try {
            //const log = await this.git.log();
            const map: Map<string, DefaultLogFields> = new Map();
            for (let l of log.all) {
                map.set(l.message, l); //todo, maybe add multiple hashes if unsure of message.
                this.commitList[l.message] = l.date;
                //console.log(`Commit: ${l.message}, ${l.hash}`);
                //console.log(`Commit: ${l}`);
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
    
    // Only want parse files changed to save time.
    private async getChangedFiles(hash: string, commit: string): Promise<string[]> {
        try {
            let res: string[];
            if (hash === '0000000000000000000000000000000000000000')
                res = (await this.executeGitCommand(`diff HEAD --name-only`)).split('\n').map(s => s.trim()).filter(Boolean);
            else if (hash === this.headCommit)
                res = (await this.executeGitCommand(`diff HEAD --name-only`)).split('\n').map(s => s.trim()).filter(Boolean);
            else {
                res = (await this.executeGitCommand(`diff ${hash}~..${hash} --name-only`)).split('\n').map(s => s.trim()).filter(Boolean);
                if (vscode.workspace.getConfiguration('GitVision').get('findRenamedFiles'))
                    res = res.concat((await this.executeGitCommand(`diff ${hash}~..HEAD --find-renames=70% --name-only`)).split('\n').map(s => s.trim()).filter(Boolean));
            }

            if (res.length > 100)
                return [];

            let changedFiles: string[] = [];
            for (let file of res) {
                if (this.gitLsFiles.has(file)) {
                    changedFiles.push(file);
                }
                else {
                    file = file.split("/").slice(-1)[0];
                    //const newFile = (await this.executeGitCommand(`ls-files | grep ${file} || true`)).trim(); 
                    //const matchedFiles = newFile.split('\n').filter(f => f.includes(file));
                    //TODO maybe use map to prevent repeat searches
                    //TODO: handle multiple files returned. For now, just do nothing as we can't really know if it was renamed.
                    //Also, this will cause an issue if two files have the same name but one is deleted. But should be fine as long as hash is not found.
                    const matchedFiles = Array.from(this.gitLsFiles).filter(f => f.includes(file));

                    // Handle multiple files returned
                    if (matchedFiles.length === 1) {
                        changedFiles.push(matchedFiles[0]);
                    }
                }
            }

            if (changedFiles.length === 0) {
                ms.debugInfo(`Founds 0 files with changes for commit ${commit}`);
            }
            return changedFiles;
        } catch (error: unknown) {
            let message = 'Unknown error';
            if (error instanceof Error) {
                message = error.message;
            }
            vscode.window.showErrorMessage(`Error getting changed files for commit: <${commit}>`);
            return [];
        }
    }

    //input is a list of commit messages
    private async fillHashAndFileSet(commitList: string[]) {

        if (this.gitLogMap.size === 0) {
            //ms.debugLog(`No git log found. Please check that you are in a git repository.`);
            vscode.window.showErrorMessage(`No git log found.`);
        }

        if (false) {
            this.gitLogMap.forEach((value, key) => {
                if (key in commitList) { ms.debugLog(`Key: ${key}, Value: ${value.hash}`); }
            });
        }

        const filePromises = commitList.map(commit => {
            const hash = this.gitLogMap.get(commit)?.hash;
            if (hash) {
                this.commitHashSet.add(hash);
                return this.getChangedFiles(`${hash}`, commit);
            }
            return Promise.resolve([]);
        });

        const set = new Set<string>((await Promise.all(filePromises)).flat());
        for (const file of set) {
            if (fs.existsSync(path.join(GIT_REPO, file))) {
                //ms.debugLog(`File exists: ${file}`);
                this.gitHighlightFiles.add(file);
            }
            else {
                ms.debugInfo(`could not find path to file ${path.join(GIT_REPO, file)}`);
            }
        }
        //set.forEach(file => this.gitHighlightFiles.add(file));

        if (ms.DEBUG) {
            ms.debugLog(`==Files with changes==`);
            for (let file of this.gitHighlightFiles)
                ms.debugLog(`${file}`);
            ms.debugLog(`======================`);
        }

        //vscode.window.showInformationMessage(`Changes found in ${this.gitHighlightFiles.size} files`);
        //ms.debugLog(`Changes found in ${this.gitHighlightFiles.size} files`);
        if (this.gitHighlightFiles.size > 100) {
            let confirmation = await vscode.window.showInformationMessage(`Detected a large number of changes: ${this.gitHighlightFiles.size} files found with changes. Are you sure you wish to process them?`, { modal: true }, 'Yes', 'No');

            if (!(confirmation === 'Yes')) {
                this.clearHighlightData();
            }
        }
    }

    //The main function that gets the highlights
    /*
    reliant on...
    @this.commitHashSet
    @this.gitHighlightData
    */
    private async fillGitHighlightData() {
        for (let file of this.gitHighlightFiles) {
            ms.debugLog(`finding hash data for file: ${file}`);
            file = path.join(GIT_REPO, file);
            const count = (await this.updateFileHighlights(file));
            if (count)
                this.fileCounter.set(file, count);
            if (ms.DEBUG) {
                ms.debugLog(`==Highlights for ${file}==`);
                ms.debugLog(`${this.gitHighlightData}`);
                ms.debugLog(`${this.gitHighlightData[vscode.Uri.file(path.join(GIT_REPO, file)).toString()]}`);
                ms.debugLog(`========================`);
            }
        }
        //ms.debugLog(`highlights filled for ${this.fileCounter.size} files}`);
        //this.gitHighlightFiles = updatedGitHighlightFiles;
    }

    //File should be in the form relative path
    async updateFileHighlights(file: string): Promise<number> {
        //ms.debugLog(`updating fileHighlights for file ${file}`);
        let foundInHashSet = false;
        let count = 0;
        try {
            const blameFile: string[] = (await this.executeGitCommand(`blame -l ${file}`)).split('\n');
            //const blameFile: string[] = (await this.git.raw(['blame', `-l`, `${file}`])).split('\n');
            if (blameFile.length === 0)
                return 0;

            this.gitHighlightData[file] = [];
            for (let lineNumber = 0; lineNumber < blameFile.length; lineNumber++) {
                let lineHash = blameFile[lineNumber].split(' ')[0].trim();
                if (this.commitHashSet.has(lineHash)) {
                    this.gitHighlightData[file].push(lineNumber);
                    foundInHashSet = true;
                    count++;
                }
            }
        } catch (error) {
            console.error(`Error getting blame for file: ${file}`);
            //vscode.window.showErrorMessage(`Error getting blame for file: ${file}`);
            ms.debugInfo(`Error getting blame for file: ${file}`);
            return 0;
        }
        return count;
    }

    async addCurrentBranch(): Promise<void> {
        try {
            let branchCommits: string[] = (await this.git.raw(['log', 'main..HEAD', `--pretty=format:%s`])).split('\n').map(s => s.trim()).filter(Boolean);
            //ms.debugLog(`Commits to be added: ${branchCommits}`);
            //await this.addCommits(branchCommits); //TODOFIX
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error getting branch commits`);
        }
    }

    async addCommits(commitList: { [key: string]: string }): Promise<void> {
        let temp: string[] = Object.keys(commitList);
        // These are currently always called together so I should probably combine them
        await this.fillHashAndFileSet(temp);
        await this.fillGitHighlightData();
    }

    getGitHighlightData(): { [file: string]: number[] } {
        return this.gitHighlightData;
    }

    getHighlightFiles(): Map<string, number> {
        return this.fileCounter;
    }

    putHighlightFiles(newFiles: Set<string>): void {
        this.gitHighlightFiles = newFiles;
    }

    //This might cause issues in the future
    clearHighlightData() {
        this.gitHighlightData = {};
        this.gitHighlightFiles = new Set();
        this.commitHashSet = new Set();
        this.fileCounter = new Map();
    }

    saveState(context: vscode.ExtensionContext) {
        //look into this for maintaining state
        let count = context.globalState.get<number>('count');
        if (count === undefined)
            count = 0;
        context.globalState.update('count', count + 1);
    }

    getCommitList(): { [key: string]: string } {
        return this.commitList;
    }

    private siblingMessageShown: boolean = false;
    async getBrothers(commit: string) {
        const hash = this.gitLogMap.get(commit)?.hash;
        let res: { [key: string]: string } = {};
        if (hash) {
            const hashes = (await this.executeGitCommand(`log --pretty=format:%H ${hash}^1..${hash}`)).split("\n");
            for (let h of hashes) {
                //this.commitList[l.message] = l.date;
                const commitMessage = (await this.executeGitCommand(`show -s --format=%s ${h}`)).trim();
                res[commitMessage] = this.commitList[commitMessage];
            }
        }
        if (Object.keys(res).length > 1 && !this.siblingMessageShown) {
            ms.basicInfo(`Settings: Bundle Merged Branches enabled -- Will add commits bundled with merges`);
            this.siblingMessageShown = true;
        }
        return res;
    }
}