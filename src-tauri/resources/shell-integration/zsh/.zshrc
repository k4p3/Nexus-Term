# NexusTerm shell integration (proxy). Loads the user's own file, restores
# ZDOTDIR and installs the OSC 133 hooks last, so frameworks cannot override them.
{
  builtin local __nt_u="${NEXUSTERM_USER_ZDOTDIR:-$HOME}"
  [[ -r "$__nt_u/.zshrc" ]] && builtin source -- "$__nt_u/.zshrc"
}
if [[ -n "$NEXUSTERM_USER_ZDOTDIR" ]]; then
  export ZDOTDIR="$NEXUSTERM_USER_ZDOTDIR"
else
  unset ZDOTDIR
fi
unset NEXUSTERM_USER_ZDOTDIR

if [[ -n "$NEXUSTERM_SHELL_INTEGRATION" && -z "$__nt_si_loaded" ]]; then
  typeset -g __nt_si_loaded=1 __nt_ran=
  __nt_precmd() {
    local ec=$?
    [[ -n "$__nt_ran" ]] && builtin printf '\e]133;D;%s\a' "$ec"
    __nt_ran=
    builtin printf '\e]133;A\a'
    [[ "$PS1" == *$'\e]133;B'* ]] || PS1+=$'%{\e]133;B\a%}'
  }
  __nt_preexec() {
    __nt_ran=1
    builtin printf '\e]133;C\a'
  }
  precmd_functions+=(__nt_precmd)
  preexec_functions+=(__nt_preexec)
fi
