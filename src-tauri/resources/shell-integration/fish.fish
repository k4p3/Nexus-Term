# NexusTerm shell integration for fish < 4 (fish 4+ emits OSC 133 natively).
set -q NEXUSTERM_SHELL_INTEGRATION; or return
set -q __nt_si_loaded; and return
set -l major (string split . -- $version)[1]
test "$major" -ge 4 2>/dev/null; and return
set -g __nt_si_loaded 1
set -g __nt_ran 0

functions -q fish_prompt; and functions -c fish_prompt __nt_orig_fish_prompt
function fish_prompt
    set -l ec $status
    printf '\e]133;A\a'
    if functions -q __nt_orig_fish_prompt
        __nt_orig_fish_prompt
    end
    printf '\e]133;B\a'
end

function __nt_preexec --on-event fish_preexec
    set -g __nt_ran 1
    printf '\e]133;C\a'
end

function __nt_postexec --on-event fish_postexec
    set -l ec $status
    test "$__nt_ran" = 1; and printf '\e]133;D;%s\a' $ec
    set -g __nt_ran 0
end
