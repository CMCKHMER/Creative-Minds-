const r=/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i;function n(e){const t=String(e??"");return!/^[=+\-@\t\r]/.test(t)||r.test(t)?t:`'${t}`}export{n as c};
