import type { SimpleSettingCommandOption } from './simpleSettings';

export const COMMON_COMMAND_PROGRAMS: SimpleSettingCommandOption[] = [
    {
        value: 'gws',
        title: 'Google Workspace skills',
        description: 'Run the local gws helper used by Google Workspace skills.',
    },
    {
        value: 'git',
        title: 'Git',
        description: 'Inspect repository history, diffs, branches, and status.',
    },
    {
        value: 'gh',
        title: 'GitHub CLI',
        description: 'Work with GitHub issues, pull requests, and workflow runs.',
    },
    {
        value: 'node',
        title: 'Node.js',
        description: 'Run JavaScript tooling and project scripts.',
    },
    {
        value: 'npm',
        title: 'npm',
        description: 'Install packages and run npm scripts.',
    },
    {
        value: 'pnpm',
        title: 'pnpm',
        description: 'Install packages and run pnpm scripts.',
    },
    {
        value: 'yarn',
        title: 'Yarn',
        description: 'Install packages and run Yarn scripts.',
    },
    {
        value: 'python3',
        title: 'Python 3',
        description: 'Run Python scripts and project checks.',
    },
    {
        value: 'go',
        title: 'Go',
        description: 'Run Go builds, tests, and formatters.',
    },
    {
        value: 'make',
        title: 'Make',
        description: 'Run project Makefile tasks.',
    },
    {
        value: 'docker',
        title: 'Docker',
        description: 'Run container-based development tasks.',
    },
    {
        value: 'uv',
        title: 'uv',
        description: 'Run Python package and virtual environment workflows.',
    },
];
