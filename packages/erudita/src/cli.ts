#!/usr/bin/env node
import { cli } from 'gunshi'
import fetchCommand from './commands/fetch.js'
import listCommand from './commands/list.js'
import showCommand from './commands/show.js'
import updateCommand from './commands/update.js'
import clearCommand from './commands/clear.js'

const mainCommand = {
  name: 'erudita',
  description: 'CLI for downloading and caching documentation from llms.txt',
  run: () => {
    console.log('erudita - Documentation cache CLI\n')
    console.log('Commands:')
    console.log('  fetch   Fetch llms.txt documentation for packages')
    console.log('  list    List all cached package documentation')
    console.log('  show    Display cached documentation for a package')
    console.log('  update  Refresh cached documentation for packages')
    console.log('  clear   Remove cached documentation')
    console.log('\nRun `erudita <command> --help` for more information.')
  },
}

await cli(process.argv.slice(2), mainCommand, {
  name: 'erudita',
  version: '0.0.0',
  description: 'CLI for downloading and caching documentation from llms.txt',
  subCommands: {
    fetch: fetchCommand,
    list: listCommand,
    show: showCommand,
    update: updateCommand,
    clear: clearCommand,
  },
})
