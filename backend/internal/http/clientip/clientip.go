// Package clientip is the client address as the edge saw it (caeli).
package clientip

import (
	"net"
	"net/http"
	"strings"
)

// FromRequest returns the address ingress-nginx saw. nginx sets X-Real-IP to
// the TCP peer, and nothing proxies in front of replay.getcaeli.com, so that is
// the client. X-Forwarded-For is NOT read: a browser can set it to anything,
// and realip.FromRequest trusted its first public entry. The session's "ip"
// metadata and its geo both come from here, so the two always agree.
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
