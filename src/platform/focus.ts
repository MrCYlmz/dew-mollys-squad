// Calls onFocusLost when the page loses focus or goes to the background. Returns a function that stops listening.
export function watchFocus(onFocusLost: () => void): () => void {
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') onFocusLost()
  }
  window.addEventListener('blur', onFocusLost)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    window.removeEventListener('blur', onFocusLost)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

// Calls onChange with true when the page becomes visible and false when it is hidden. Returns a function that stops listening.
export function watchVisibility(onChange: (visible: boolean) => void): () => void {
  const onVisibilityChange = () => onChange(document.visibilityState === 'visible')
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => document.removeEventListener('visibilitychange', onVisibilityChange)
}
