import { useEffect, useState } from 'preact/hooks'
import { SquadCountLabel } from '../ui/components/SquadCountLabel'
import { DefeatScreen } from '../ui/screens/DefeatScreen'
import { Hud } from '../ui/screens/Hud'
import { PauseScreen } from '../ui/screens/PauseScreen'
import { TitleScreen } from '../ui/screens/TitleScreen'
import { VictoryScreen } from '../ui/screens/VictoryScreen'
import type { Game, GameView } from './game'

interface AppProps {
  // Resolves once the game's chunk, with Three.js, has loaded.
  game: Promise<Game>
}

export function App({ game: loadingGame }: AppProps) {
  const [game, setGame] = useState<Game | null>(null)
  const [view, setView] = useState<GameView | null>(null)
  useEffect(() => {
    let stopListening = () => {}
    let unmounted = false
    void loadingGame.then((loaded) => {
      if (unmounted) return
      setGame(loaded)
      setView(loaded.view)
      stopListening = loaded.subscribe(setView)
    })
    return () => {
      unmounted = true
      stopListening()
    }
  }, [loadingGame])

  // A tap on play before the game has loaded starts the run once it has.
  if (game === null || view === null) return <TitleScreen onPlay={() => void loadingGame.then((loaded) => loaded.play())} />

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
      {view.screen === 'defeat' && <DefeatScreen distanceReached={view.distanceReached} caughtBy={view.caughtBy} onRetry={() => game.restart()} />}
    </>
  )
}
