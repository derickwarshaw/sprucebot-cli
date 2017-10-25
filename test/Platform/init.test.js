/* eslint-env jest */
const fs = require('fs')
const path = require('path')
const config = require('config')
const inquirer = require('inquirer')
const childProcess = require('child_process')
const { Remote, Repository } = require('nodegit')
const hostile = require('hostile')
jest.mock('child_process')
jest.mock('inquirer')
jest.mock('hostile')
const initAction = require('../../actions/platform/init')
const { rmdir, createDir } = require('../../utils/dir')

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at:', p, 'reason:', reason)
})

const repositories = config.get('repositories')
const TEMP = `${config.get('TEMP')}/init.test`
const cwd = process.cwd()

describe('Init Action', () => {
	beforeEach(() => {
		createDir(TEMP)
		process.chdir(TEMP)
		inquirer.prompt.mockClear()
		childProcess.spawnSync.mockClear()
		expect(jest.isMockFunction(childProcess.spawnSync)).toBeTruthy()
	})
	afterEach(() => {
		process.chdir(cwd)
		rmdir(TEMP)
	})
	afterAll(() => {
		jest.unmock('inquirer')
		jest.unmock('child_process')
		jest.unmock('hostile')
	})

	test('prompts when options are missing', async () => {
		await initAction()
		expect(inquirer.prompt).toHaveBeenCalledWith([
			{
				default: `${TEMP}/sprucebot`,
				message: 'Install location (absolute path)',
				name: 'installPath',
				type: 'input'
			},
			{
				default: 'sprucelabsai',
				message:
					'Github username. (Developers should use their own. Othewise default is fine.)',
				name: 'gitUser',
				type: 'input'
			}
		])
		expect(childProcess.spawnSync).toHaveBeenCalled()
	})

	test('Does not clone if directory exists', async () => {
		const installPath = `${TEMP}/spExists`
		fs.mkdirSync(installPath)
		// init checks if repo dir exists
		for (let repo of repositories) {
			const cpyPath = path.join(installPath, repo.path)
			childProcess.spawnSync(
				'git',
				['clone', `git@github.com:sprucelabsai/${repo.name}`, cpyPath],
				{
					cwd: installPath
				}
			)
		}

		const oldLog = console.log
		console.log = jest.fn((...args) => oldLog(...args))
		await initAction(installPath, { gitUser: 'test' })

		repositories.forEach(repo =>
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining(
					`Oh snap, looks like you already installed something at ${path.join(
						installPath,
						repo.path
					)}`
				)
			)
		)

		console.log = oldLog
	})

	describe('Successful run', () => {
		const installPath = `${TEMP}/spTeset`

		beforeEach(async () => {
			rmdir(installPath)
			await initAction(installPath, { gitUser: 'test' })
			expect(fs.existsSync(installPath)).toBeTruthy()
			expect(inquirer.prompt).toHaveBeenCalledWith([])
		})

		test('Syncs git repositories', () => {
			repositories.forEach(repo => {
				const repoUrl = `git@github.com:${config.get('gitUser')}/${repo.name}`
				expect(childProcess.spawnSync).toHaveBeenCalledWith(
					'git',
					['clone', repoUrl, path.join(installPath, repo.path)],
					{
						stdio: 'inherit',
						env: process.env
					}
				)
			})
		})

		test('sets git remote upstream', async () => {
			for (let repo of repositories) {
				const repository = await Repository.open(
					path.join(installPath, repo.path)
				)
				const remotes = await Remote.list(repository)
				expect(remotes).toEqual(expect.arrayContaining(['origin', 'upstream']))
			}
		})

		test('Copies .env examples', () => {
			expect(fs.existsSync(path.join(installPath, 'web/.env'))).toBeTruthy()
			expect(fs.existsSync(path.join(installPath, 'api/app/.env'))).toBeTruthy()
			expect(
				fs.existsSync(path.join(installPath, 'sprucebot-relay/.env'))
			).toBeTruthy()
		})

		test('Installs yarn dependencies', () => {
			repositories.forEach(repo => {
				expect(childProcess.spawnSync).toHaveBeenCalledWith(
					'yarn',
					['install', '--ignore-engines'],
					{
						cwd: path.join(installPath, repo.path),
						env: process.env,
						stdio: 'inherit'
					}
				)
			})
		})

		test('checks if hosts file is properly configured', () => {
			expect(hostile.get).toHaveBeenCalled()
		})
	})
})