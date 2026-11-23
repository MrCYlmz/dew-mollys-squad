import { useEffect, useState } from 'preact/hooks'
import { SquadCountLabel } from '../ui/components/SquadCountLabel'
import { DefeatScreen } from '../ui/screens/DefeatScreen'
import { Hud } from '../ui/screens/Hud'
import { PauseScreen } from '../ui/screens/PauseScreen'
import { TitleScreen } from '../ui/screens/TitleScreen'
import { VictoryScreen } from '../ui/screens/VictoryScreen'
import type { Game } from './game'

interface AppProps {
  game: Game
}

export function App({ game }: AppProps) {
  const [view, setView] = useState(game.view)
  useEffect(() => game.subscribe(setView), [game])

  const inRun = view.screen === 'playing' || view.screen === 'paused'
  return (
    <>
      {inRun && <SquadCountLabel count={view.squadCount} ref={game.setSquadLabel} />}
      {inRun && <Hud progress={view.progress} boss={view.boss} onPause={() => game.pause()} />}
      {view.screen === 'title' && <TitleScreen onPlay={() => game.play()} />}
      {view.screen === 'paused' && (
        <PauseScreen onResume={() => game.resume()} onRestart={() => game.restart()} onQuit={() => game.quitToTitle()} />
      )}
      {view.screen === 'victory' && (
        <VictoryScreen catsLeft={view.squadCount} onNextLevel={() => game.nextLevel()} onBackToTitle={() => game.quitToTitle()} />
      )}
      {view.screen === 'defeat' && (
        <DefeatScreen distanceReached={view.distanceReached} lossCause={view.lossCause} caughtBy={view.caughtBy} onRetry={() => game.restart()} />
      )}
    </>
  )
}
