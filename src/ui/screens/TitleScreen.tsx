import { strings } from '../../content/strings'

interface TitleScreenProps {
  onPlay: () => void
  // The game could not be loaded; a tap tries again.
  loadFailed?: boolean
}

export function TitleScreen({ onPlay, loadFailed = false }: TitleScreenProps) {
  return (
    <button type="button" class="screen title-screen" onClick={onPlay}>
      <h1 class="game-name">{strings.gameName}</h1>
      <span class={loadFailed ? 'load-failed' : 'tap-to-play'}>{loadFailed ? strings.loadFailed : strings.tapToPlay}</span>
    </button>
  )
}
