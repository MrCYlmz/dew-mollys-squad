import { strings } from '../../content/strings'

interface TitleScreenProps {
  onPlay: () => void
}

export function TitleScreen({ onPlay }: TitleScreenProps) {
  return (
    <button type="button" class="screen title-screen" onClick={onPlay}>
      <h1 class="game-name">{strings.gameName}</h1>
      <span class="tap-to-play">{strings.tapToPlay}</span>
    </button>
  )
}
