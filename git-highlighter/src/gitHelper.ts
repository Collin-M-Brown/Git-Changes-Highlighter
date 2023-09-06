import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getWorkspacePath } from './library';
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
        console.error(`Error executing command "${command}":`, error); //seems to be trigged by deleted file that has blame in it...
        process.exit(1);
    }
}

function getHashSet(): [string[], CommitName, string[]] {
    //const user_path = vscode.workspace.getConfiguration('git-highlighter').get('CommitListPath'); TODO FIX
    debugLog(path.join(workspacePath, '.vscode/CommitList'));    
    let branches = fs.readFileSync(path.join(workspacePath, '.vscode/CommitList'), 'utf8').split('\n');

    branches = branches.filter(line => line.trim() !== '');
    const commitHash: string[] = [];
    const commitName: CommitName = {};
    let files: string[] = [];

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
            console.log(`Merged branch: ${branch} -> ${hash}`);
        } else {
            for (let l of gitLog) {
                if (l.includes('commit')) {
                    hash = l.split(' ')[1];
                    console.log(`Non-commit merge: ${branch} -> ${hash}`);
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

export default function compileDiffLog() {
    const [commitHash, commitName, files] = getHashSet();
    const highlights: { [uri: string]: number[] } = {};
    
    for (let file of files) {
        if (file.trim() === '') {
            continue;
        }
        const uri = vscode.Uri.file(path.join(workspacePath, file)).toString();
        highlights[uri] = [];
        debugLog(`Blame file: ${path.join(workspacePath, file)}`);
        const fileInGit = executeCommand(`git ls-files ${file}`);
        if (!fileInGit) {
            continue;
        }
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