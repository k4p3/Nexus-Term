# NexusTerm shell integration for bash. Replicates the login-shell startup
# (we are started with --init-file instead of -l) and then installs OSC 133 hooks.
[ -r /etc/profile ] && . /etc/profile
if [ -r "$HOME/.bash_profile" ]; then . "$HOME/.bash_profile"
elif [ -r "$HOME/.bash_login" ]; then . "$HOME/.bash_login"
elif [ -r "$HOME/.profile" ]; then . "$HOME/.profile"
fi

if [ -n "$NEXUSTERM_SHELL_INTEGRATION" ] && [ -z "$__nt_si_loaded" ]; then
  __nt_si_loaded=1
  __nt_first=1
  __nt_prompt() {
    local ec=$?
    if [ -z "$__nt_first" ]; then printf '\e]133;D;%s\a' "$ec"; fi
    __nt_first=
    printf '\e]133;A\a'
    case "$PS1" in *$'\e]133;B'*) ;; *) PS1="$PS1"'\[\e]133;B\a\]' ;; esac
    return "$ec"
  }
  case "$(declare -p PROMPT_COMMAND 2>/dev/null)" in
    "declare -a"*) PROMPT_COMMAND=(__nt_prompt "${PROMPT_COMMAND[@]}") ;;
    *) PROMPT_COMMAND="__nt_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
  esac
  PS0="${PS0}"$'\e]133;C\a'
fi
