// Package clientip is the client address as the edge saw it (caeli).
package clientip

import (
	"net"
	"net/http"
	"strings"
)

// FromRequest returns the address the edge saw. It TRUSTS X-Real-IP, so it is
// only right behind an edge that overwrites that header with the TCP peer.
// replay.getcaeli.com's does: its ingress (nginx-ingress on the box) sends
// `proxy_set_header X-Real-IP $remote_addr` with no real_ip directives, and
// nothing proxies in front of it. The repo's scripts/docker-compose/nginx.conf
// does NOT (it derives X-Real-IP from X-Forwarded-For), so this must not run
// behind that config. X-Forwarded-For is never read here: a browser can set it
// to anything, and realip.FromRequest trusted its first public entry. The
// session's "ip" metadata and its geo both come from here, so they agree.
func FromRequest(r *http.Request) string {
	if ip := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); ip != nil {
		return ip.String()
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.String()
	}
	return ""
}
