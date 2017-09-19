const path = require('path')
const chalk = require('chalk')

const Generator = require('../base')

const {
  fileExists
} = require('../../utils/dir')

module.exports = class extends Generator {
  async initializing () {
    this.sourceRoot(path.join(__dirname, 'templates'))
    this.promptValues = await this.getPromptValues()
    this.destinationRoot(this.promptValues.path)
  }

  configuring () {
    if (!fileExists(this.destinationPath('docker-compose.yml'))) {
      this.env.error(chalk.bold.red(`Uh oh, I can't find a valid docker-compose.yml in ${this.promptValues.path}. Try Googling 'Sprucebot platform docker-compose'.`))
    }
  }

  starting () {
    this.spawnCommandSync('docker-compose', ['down'], {
      cwd: this.promptValues.path
    })
    this.spawnCommandSync('docker-compose', ['build'], {
      cwd: this.promptValues.path
    })
    this.spawnCommandSync('docker-compose', ['up'], {
      cwd: this.promptValues.path
    })
  }

  end () {
    this.log('end')
  }
}
