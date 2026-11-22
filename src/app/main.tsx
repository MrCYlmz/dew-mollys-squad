import { render } from 'preact'
import { levels } from '../content/levels'
import { strings } from '../content/strings'
import '../ui/styles.css'
import { App } from './App'
import { Game } from './game'

const gameElement = document.getElementById('game')
const canvas = document.getElementById('scene')
const uiRoot = document.getElementById('ui')
if (!(gameElement instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement) || !(uiRoot instanceof HTMLElement)) {
  throw new Error('index.html is missing the game, scene or ui element')
}

document.title = strings.gameName
const game = new Game(levels, canvas, gameElement)
render(<App game={game} />, uiRoot)
