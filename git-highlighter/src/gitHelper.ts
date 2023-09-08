import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';
import { getWorkspacePath, getCommitList } from './library';
import { debugLog } from './library';
import { debug } from 'console';
import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git';
import { debuglog } from 'util';

const workspacePath = getWorkspacePath();
const git: SimpleGit = simpleGit(workspacePath);
console.log("awaiting...");
let gitLsFiles: Promise<string> = git.raw(['ls-files']);
let gitBlame: Promise<string> = git.raw([])
let gitLogPromise: Promise<Map<string, DefaultLogFields>> = setGitLogMap();
let gitLogMap: Map<string, DefaultLogFields> = new Map();

type hashToMessageMap = {
    [key: string]: string;
};

export function executeCommand(command: string): string {
    try {
        const output = execSync(`cd ${workspacePath} && ${command}`);// maybe cd at start
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

async function getChangedFiles(hash1: string, hash2: string): Promise<string[]> {
    let files = (await git.raw(['diff', '--relative', `${hash1}..${hash2}`, '--name-only'])).split('\n').map(s => s.trim()).filter(Boolean);
    return files;
}

async function filterFiles(files: string[]): Promise<string[]> {

    //n^2 to compare all, could sort them both
    //TODO: Optimize this to get all files first before filtering
    //let GitFiles = executeCommand(`git ls-files`).split('\n').map(s => s.trim()).filter(Boolean);
    let GitFiles = (await gitLsFiles).split('\n').map(s => s.trim()).filter(Boolean);

    files.sort();
    GitFiles.sort();

    let res: string[] = [];
    let i = 0, j = 0;
    while (i < files.length && j < GitFiles.length) {
        //console.log(`Files[i]: ${files[i]} GitFiles[j]: ${GitFiles[j]}`);
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

async function setGitLogMap(): Promise<Map<string, DefaultLogFields>>  {

    const git: SimpleGit = simpleGit(workspacePath);
    const log = await git.log();
    //console.log(log);

    const map: Map<string, DefaultLogFields> = new Map();
    for (let l of log.all) {
        map.set(l.message, l); //todo, maybe add multiple hashes if unsure of message.
    }
    return map;
}

export async function getHashSet(): Promise<[string[], hashToMessageMap, string[]]> {
    let branches: string[] = getCommitList();

    branches = branches.filter(line => line.trim() !== '');
    const commitHashSet: string[] = [];
    const hashToMessageMap: hashToMessageMap = {};
    let filesChanged: string[] = [];

    //// setGitLog should finish first
    gitLogMap = await gitLogPromise;
    debugLog(`gitLogMap finished`);
    debugLog(`branches: ${branches}`);

    //make a branch name to hashSet map
    for (let branch of branches) {

        const hash = gitLogMap.get(branch)?.hash;
        if (hash)
        {
            const file = await getChangedFiles(`${hash}~`, `${hash}`); //maybe I should get all first and await lsfiles
            filesChanged = filesChanged.concat(file);
            commitHashSet.push(hash.trim());
            hashToMessageMap[hash] = branch;
        }
    }

    filesChanged = Array.from(new Set((await filterFiles(filesChanged))));
    vscode.window.showInformationMessage(`Changes found in ${filesChanged.length} files`);
    return [commitHashSet, hashToMessageMap, filesChanged];
}

export async function compileDiffLog(): Promise<string> {

    //Get a set of all the hash values used for commits. Want to avoid calling unless commitList changes
    const [commitHashSet, hashToMessageMap, filesChanged] = await getHashSet();
    const highlights: { [uri: string]: number[] } = {};
    
    for (let file of filesChanged) {
        if (file.trim() === '') {
            continue;
        }
        const uri = vscode.Uri.file(path.join(workspacePath, file)).toString();
        highlights[uri] = [];

        const blame = executeCommand(`git blame -l ${file}`).trim().split('\n');
        //const blame = (await git.raw(['blame', '-l', `${file}`])).trim().split('\n');
        //console.log(blame);
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