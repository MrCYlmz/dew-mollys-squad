import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import viteConfig from '../../vite.config'

const repoFolder = fileURLToPath(new URL('../../', import.meta.url))
const workflowFolder = `${repoFolder}.github/workflows/`
const liveUrl = 'https://mrcylmz.github.io/dew-mollys-squad/'

// The workflow that deploys to GitHub Pages, as text: the checks read its lines, without a YAML parser.
function pagesWorkflow(): string {
  const deploying = readdirSync(workflowFolder)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => readFileSync(workflowFolder + name, 'utf8'))
    .filter((text) => text.includes('actions/deploy-pages@'))
  expect(deploying).toHaveLength(1)
  return deploying[0] ?? ''
}

// requirements S-7 (1): deploys dist/ on every push to main with the official Pages actions, after typecheck,
// lint, tests and the size check.
describe('pages workflow', () => {
  it('deploys_on_every_push_to_main', () => {
    expect(pagesWorkflow()).toMatch(/^on:\s*\n(?:[ \t]+.*\n)*?[ \t]+push:\s*\n[ \t]+branches:\s*(?:\[\s*['"]?main['"]?\s*\]|\n[ \t]+-\s*['"]?main['"]?)/m)
  })

  it('uploads_dist_as_the_pages_artifact', () => {
    const workflow = pagesWorkflow()
    expect(workflow).toContain('actions/upload-pages-artifact@')
    expect(workflow).toMatch(/path:\s*['"]?\.?\/?dist\/?['"]?\s*$/m)
  })

  it.each(['npm run typecheck', 'npm run lint', 'npm test', 'npm run build', 'npm run size'])('runs_%s_before_deploying', (command) => {
    const workflow = pagesWorkflow()
    const commandAt = workflow.indexOf(`run: ${command}`)
    expect(commandAt).toBeGreaterThanOrEqual(0)
    expect(commandAt).toBeLessThan(workflow.indexOf('actions/deploy-pages@'))
  })

  // requirements S-7 (3): least privilege, only the latest push deploys, pinned action versions.
  it('grants_only_read_contents_and_pages_and_id_token_write', () => {
    const workflow = pagesWorkflow()
    expect(workflow).toMatch(/^\s+contents:\s*read\s*$/m)
    expect(workflow).toMatch(/^\s+pages:\s*write\s*$/m)
    expect(workflow).toMatch(/^\s+id-token:\s*write\s*$/m)
    expect(workflow).not.toMatch(/write-all|contents:\s*write/)
  })

  it('lets_only_the_latest_push_deploy', () => {
    expect(pagesWorkflow()).toMatch(/^\s*concurrency:/m)
  })

  it('pins_every_action_version', () => {
    const actionRefs = [...pagesWorkflow().matchAll(/uses:\s*['"]?([^\s'"#]+)/g)].map((match) => match[1] ?? '')
    expect(actionRefs.length).toBeGreaterThan(0)
    for (const actionRef of actionRefs) expect(actionRef).toMatch(/@(?:[0-9a-f]{40}|v\d+(?:\.\d+){0,2})$/)
  })
})

// requirements S-7 (2): assets resolve under the /dew-mollys-squad/ base.
describe('pages path', () => {
  it('build_serves_assets_under_the_repo_path', () => {
    expect(viteConfig.base).toBe('/dew-mollys-squad/')
  })
})

// requirements S-7 (4): the README states the live URL and how to deploy.
describe('readme', () => {
  const readmePath = `${repoFolder}README.md`

  it('states_the_live_url', () => {
    expect(existsSync(readmePath)).toBe(true)
    expect(readFileSync(readmePath, 'utf8')).toContain(liveUrl)
  })
})
