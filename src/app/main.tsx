import { render } from 'preact'
import { levels } from '../content/levels'
import { strings } from '../content/strings'
import '../ui/styles.css'
import { App } from './App'
import { readLaunchFlags } from './launchFlags'
import { stressLevel } from './stressLevel'

const gameElement = document.getElementById('game')
const canvas = document.getElementById('scene')
const uiRoot = document.getElementById('ui')
if (!(gameElement instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement) || !(uiRoot instanceof HTMLElement)) {
  throw new Error('index.html is missing the game, scene or ui element')
}

document.title = strings.gameName
const flags = readLaunchFlags(location.search)
// Three.js is most of the download, so the game comes in its own chunk and the title screen shows before it arrives.
const game = import('./game').then(({ Game }) => new Game(flags.stress ? [stressLevel] : levels, canvas, gameElement, flags))
render(<App game={game} />, uiRoot)
