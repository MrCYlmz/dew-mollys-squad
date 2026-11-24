import { useEffect, useRef, useState } from 'preact/hooks'
import { HandIcon } from '../ui/components/HandIcon'
import { SquadCountLabel } from '../ui/components/SquadCountLabel'
import { DefeatScreen } from '../ui/screens/DefeatScreen'
import { Hud } from '../ui/screens/Hud'
import { PauseScreen } from '../ui/screens/PauseScreen'
import { TitleScreen } from '../ui/screens/TitleScreen'
import { VictoryScreen } from '../ui/screens/VictoryScreen'
import type { Game, GameView } from './game'

interface AppProps {
  // Loads the game's chunk, with Three.js, over the network; it fails on a bad connection, or when a deploy has replaced
  // the chunk an old page asks for.
  loadGame: () => Promise<Game>
}

export function App({ loadGame }: AppProps) {
  const [game, setGame] = useState<Game | null>(null)
  const [view, setView] = useState<GameView | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  // A tap on play before the game has loaded starts the run once it has.
  const playWhenLoaded = useRef(false)
  useEffect(() => {
    let stopListening = () => {}
    let unmounted = false
    loadGame().then(
      (loaded) => {
        if (unmounted) return
        setGame(loaded)
        setView(loaded.view)
        stopListening = loaded.subscribe(setView)
        if (playWhenLoaded.current) loaded.play()
      },
      () => {
        if (!unmounted) setLoadFailed(true)
      },
    )
    return () => {
      unmounted = true
      stopListening()
    }
  }, [loadGame, loadAttempt])

  if (game === null || view === null) {
    const retryLoad = () => {
      setLoadFailed(false)
      setLoadAttempt((attempt) => attempt + 1)
    }
    return (
      <TitleScreen
        loadFailed={loadFailed}
        onPlay={() => {
          playWhenLoaded.current = true
          if (loadFailed) retryLoad()
        }}
      />
    )
  }

  const inRun = view.screen === 'playing' || view.screen === 'paused'
  return (
    <>
      {inRun && <SquadCountLabel count={view.squadCount} ref={game.setSquadLabel} />}
      {inRun && <Hud level={view.level} progress={view.progress} boss={view.boss} onPause={() => game.pause()} />}
      {view.screen === 'playing' && view.handIcon && <HandIcon />}
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
