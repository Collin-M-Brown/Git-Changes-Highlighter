import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';
import { getWorkspacePath, getCommitList } from './library';
import { debugLog } from './library';
import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git';

type hashToMessageMap = {
    [key: string]: string;
};

export class GitProcessor {
    private workspacePath: string;
    private git: SimpleGit;
    private gitLsFiles: Promise<string>;
    private gitLogPromise: Promise<Map<string, DefaultLogFields>>;
    private gitLogMap: Map<string, DefaultLogFields>;

    constructor() {
        this.workspacePath = getWorkspacePath();
        this.git = simpleGit(this.workspacePath);
        console.log("awaiting...");
        this.gitLsFiles = this.git.raw(['ls-files']);
        this.gitLogPromise = this.setGitLogMap();
        this.gitLogMap = new Map();
    }

    executeCommand(command: string): string {
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

    async getChangedFiles(hash1: string, hash2: string): Promise<string[]> {
        let files = (await this.git.raw(['diff', '--relative', `${hash1}..${hash2}`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
        return files;
    }

    async filterFiles(files: string[]): Promise<string[]> {
        let GitFiles = (await this.gitLsFiles).split('\n').map(s => s.trim()).filter(Boolean);
        files.sort();
        GitFiles.sort();

        let res: string[] = [];
        let i = 0, j = 0;
        while (i < files.length && j < GitFiles.length) {
            if (files[i] === GitFiles[j]) {
                res.push(files[i]);
                i++;
                j++;
            } else if (files[i] < GitFiles[j]) {
                i++;
            } else {
                j++;
            }
        }

        debugLog(`All Files with changes: ${res}`);
        return res;
    }

    async setGitLogMap(): Promise<Map<string, DefaultLogFields>> {
        const log = await this.git.log();
        const map: Map<string, DefaultLogFields> = new Map();
        for (let l of log.all) {
            map.set(l.message, l); //todo, maybe add multiple hashes if unsure of message.
        }
        return map;
    }

    async getHashSet(): Promise<[string[], hashToMessageMap, string[]]> {
        let branches: string[] = getCommitList();
        branches = branches.filter(line => line.trim() !== '');
        const commitHashSet: string[] = [];
        const hashToMessageMap: hashToMessageMap = {};
        let filesChanged: string[] = [];

        this.gitLogMap = await this.gitLogPromise;
        debugLog(`gitLogMap finished`);
        debugLog(`branches: ${branches}`);

        for (let branch of branches) {
            const hash = this.gitLogMap.get(branch)?.hash;
            if (hash) {
                const file = await this.getChangedFiles(`${hash}~`, `${hash}`);
                filesChanged = filesChanged.concat(file);
                commitHashSet.push(hash.trim());
                hashToMessageMap[hash] = branch;
            }
        }

        filesChanged = Array.from(new Set((await this.filterFiles(filesChanged))));
        vscode.window.showInformationMessage(`Changes found in ${filesChanged.length} files`);
        return [commitHashSet, hashToMessageMap, filesChanged];
    }

    async compileDiffLog(): Promise<string> {
        const [commitHashSet, hashToMessageMap, filesChanged] = await this.getHashSet();
        const highlights: { [uri: string]: number[] } = {};

        for (let file of filesChanged) {
            if (file.trim() === '') {
                continue;
            }
            const uri = vscode.Uri.file(path.join(this.workspacePath, file)).toString();
            highlights[uri] = [];

            const blame = this.executeCommand(`git blame -l ${file}`).trim().split('\n');
            if (blame.length === 0) {
                continue;
            }
            let index = 0;
            while (index < blame.length) {

                const line = blame[index].split(' ')[0].trim();
                if (commitHashSet.includes(line)) {
                    if (index + 1 < blame.length && commitHashSet.includes(blame[index + 1].split(' ')[0])) {
                        index++;
                        while (index + 1 < blame.length && commitHashSet.includes(blame[index + 1].split(' ')[0])) {
                            highlights[uri].push(index);
                            index++;
                        }
                        highlights[uri].push(index);
                    } else {
                        highlights[uri].push(index);
                    }
                }
                index++;
            }
        }
        console.log(highlights);

        const json = JSON.stringify(highlights, null, 4);
        //fs.writeFileSync(path.join(__dirname, 'highlights.json'), json, 'utf8');
        return json;
    }
}