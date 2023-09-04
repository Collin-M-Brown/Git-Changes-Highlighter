import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

let highlights: { [uri: string]: number[] } = {};

export type Bookmark = {
    line: number;
    column: number;
    label: string;
};

type FileData = {
    path: string;
    bookmarks: Bookmark[];
};

type CommitName = {
    [key: string]: string;
};

type Dictionary = {
    files: FileData[];
};

export function getWorkspacePath(): string {
    if (!vscode.workspace.workspaceFolders) {
        console.error('No workspace folders open');
        return '';
    }

    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

export function executeCommand(command: string): string {
    try {

        const workspacePath = getWorkspacePath();
        const output = execSync(`cd ${workspacePath} && ${command}`);
        const outputString = output.toString();
        console.log(`Completed for command "${command}": ${outputString.length}`);
        return outputString;
    } catch (error) {
        console.error(`Error executing command "${command}":`, error);
        process.exit(1);
    }
}

function createBookmark(line: number, label: string): Bookmark {
    return {
      line: line,
      column: 1,
      label: label,
    };
}

function getHashSet(): [string[], CommitName, string[]] {
    let branches = fs.readFileSync(path.join(__dirname, 'FileList'), 'utf8').split('\n');
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
        } else {
            for (let l of gitLog) {
                if (l.includes('commit')) {
                    hash = l.split(' ')[1];
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

export function compileDiffLog() {

    const [commitHash, commitName, files] = getHashSet();
    const dictionary: Dictionary = { files: [] };
    
    console.log(`commitHash: ${commitHash}`);
    console.log(`commitHash: ${commitHash[0].length}`);
    for (let file of files) {
        if (file.trim() === '') {
            continue;
        }
        console.log(`parsing blame for file: ${file}`);
        const fileData: FileData = {
            path: file,
            bookmarks: []
        };
        const blame = executeCommand(`git blame -l ${file}`).split('\n');
        let index = 0;

        while (index < blame.length) {
            const line = blame[index].split(' ')[0].trim();
            console.log(`Parsing hash from line: ${line}, ${line.length}`);
            if (commitHash.includes(line)) {
                console.log(`hash found: ${line}, ${line.length}`);
                const name = commitName[line];
                if (index + 1 < blame.length && commitHash.includes(blame[index + 1].split(' ')[0])) {
                    fileData.bookmarks.push(createBookmark(index, name));
                    index++;
                    while (index + 1 < blame.length && commitHash.includes(blame[index + 1].split(' ')[0])) {
                        fileData.bookmarks.push(createBookmark(index, "========="));
                        index++;
                    }
                    fileData.bookmarks.push(createBookmark(index, "========="));
                } else {
                    fileData.bookmarks.push(createBookmark(index, name));
                }
            }
            index++;
        }
        dictionary.files.push(fileData);
    }

    const json = JSON.stringify(dictionary, null, 4);
    fs.writeFileSync(path.join(__dirname, 'git_highlighter.json'), json, 'utf8');
}