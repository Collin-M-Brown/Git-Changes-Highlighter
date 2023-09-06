import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';
import { getWorkspacePath, getCommitList } from './library';
import { debugLog } from './library';
import { debug } from 'console';

const workspacePath = getWorkspacePath();
type CommitName = {
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
        return ""
    }
}

function getGitLog(branch: string): string {
    let log: string = executeCommand(`git log | grep -B 7 -m 1 ${branch}`);
    if (log === "") {
        vscode.window.showInformationMessage(`Branch: ${branch}, not found, spelling and spacing is case sensitive`);
    }
    return log;
}

function getChangedFiles(hash1: string, hash2: string): string[] {
    let files = executeCommand(`git diff --relative ${hash1}..${hash2} --name-only`).split('\n').map(s => s.trim()).filter(Boolean);
    
    //n^2 to compare all, could sort them both
    //TODO: Optimize this to get all files first before filtering
    let GitFiles = executeCommand(`git ls-files`).split('\n').map(s => s.trim()).filter(Boolean);

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

function getHashSet(): [string[], CommitName, string[]] {
    let branches = getCommitList();

    branches = branches.filter(line => line.trim() !== '');
    const commitHashSet: string[] = [];
    const commitName: CommitName = {};
    let files: string[] = [];

    for (let branch of branches) {
        branch = `"${branch.replace('[', '\\[').replace(']', '\\]')}"`;

        const gitLog = getGitLog(branch).split('\n'); //TODO: Optimize<get all at once>
        let hash = '';

        if (gitLog.length > 1 && gitLog[1].includes('Merge:')) {
            const diff = gitLog[1].split(' ');
            const f = getChangedFiles(diff[1], diff[2]); 
            //console.log(`Diff file result: ${f}`);
            files = files.concat(f);
            const fullHash = `"commit ${diff[2]}"`;
            hash = executeCommand(`git log | grep ${fullHash}`).split(' ')[1]; //TODO: Optimize out
            //console.log(`Merged branch: ${branch} -> ${hash}`);
        } else {
            for (let l of gitLog) {
                if (l.includes('commit')) {
                    hash = l.split(' ')[1];
                    const f = getChangedFiles(`${hash}~`, `${hash}`);
                    files = files.concat(f);
                }
            }
        }

        commitHashSet.push(hash.trim());
        commitName[hash] = branch;
    }

    files = Array.from(new Set(files));
    vscode.window.showInformationMessage(`Changes found in ${files.length} files`);
    return [commitHashSet, commitName, files];
}

export default function compileDiffLog(): string {

    //Get a set of all the hash values used for commits. Want to avoid calling unless commitList changes
    const [commitHashSet, commitName, files] = getHashSet();
    const highlights: { [uri: string]: number[] } = {};
    
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

    const json = JSON.stringify(highlights, null, 4);
    //fs.writeFileSync(path.join(__dirname, 'highlights.json'), json, 'utf8');
    return json;
}