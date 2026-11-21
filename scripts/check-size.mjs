import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const limitBytes = 5_000_000
const distFolder = 'dist'

function folderBytes(folder) {
  return readdirSync(folder, { withFileTypes: true }).reduce((total, entry) => {
    const path = join(folder, entry.name)
    return total + (entry.isDirectory() ? folderBytes(path) : statSync(path).size)
  }, 0)
}

const bytes = folderBytes(distFolder)
const megabytes = (bytes / 1_000_000).toFixed(2)

if (bytes > limitBytes) {
  console.error(`dist/ is ${megabytes} MB, above the 5 MB budget.`)
  process.exit(1)
}
console.log(`dist/ is ${megabytes} MB, within the 5 MB budget.`)
