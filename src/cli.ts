#!/usr/bin/env node
import { cli, define } from 'gunshi'
import pkg from '../package.json' with { type: 'json' }
import fetchCommand from './commands/fetch.ts'
import installCommand from './commands/install.ts'
import listCommand from './commands/list.ts'
import showCommand from './commands/show.ts'
import updateCommand from './commands/update.ts'
import clearCommand from './commands/clear.ts'
import uninstallCommand from './commands/uninstall.ts'

const mainCommand = define({
  name: 'erudita',
  description: 'CLI for downloading and caching documentation from llms.txt',
  run: () => {
    console.log('erudita - Documentation cache CLI\n')
    console.log('Commands:')
    console.log('  fetch   Fetch llms.txt documentation for packages')
    console.log('  install Install docs and link to project (.erudita/)')
    console.log('  list    List all cached package documentation')
    console.log('  show    Display cached documentation for a package')
    console.log('  update  Refresh cached documentation for packages')
    console.log('  clear   Remove cached documentation')
    console.log('  uninstall Remove docs links from the project')
    console.log('\nRun `erudita <command> --help` for more information.')
  },
})

await cli(process.argv.slice(2), mainCommand, {
  name: 'erudita',
  version: pkg.version,
  description: 'CLI for downloading and caching documentation from llms.txt',
  subCommands: {
    fetch: fetchCommand,
    install: installCommand,
    i: installCommand,
    list: listCommand,
    show: showCommand,
    update: updateCommand,
    clear: clearCommand,
    uninstall: uninstallCommand,
    u: uninstallCommand,
  },
})
