# NexusTerm shell integration (proxy). Loads the user's own file.
{
  builtin local __nt_u="${NEXUSTERM_USER_ZDOTDIR:-$HOME}"
  [[ -r "$__nt_u/.zshenv" ]] && builtin source -- "$__nt_u/.zshenv"
}
