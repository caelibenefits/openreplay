package clientip

import (
	"net/http"
	"testing"
)

// caeli: the session's "ip" metadata and its geo come from ClientIP, which must
// never take a value the browser chose.
func TestFromRequest(t *testing.T) {
	cases := []struct {
		name, realIP, xff, remote, want string
	}{
		{"edge header wins", "67.160.35.32", "", "10.42.0.7:51000", "67.160.35.32"},
		{"forged X-Forwarded-For is ignored", "67.160.35.32", "203.0.113.77", "10.42.0.7:51000", "67.160.35.32"},
		{"no edge header falls back to the TCP peer", "", "203.0.113.77", "198.51.100.4:443", "198.51.100.4"},
		{"IPv6 peer", "", "", "[2001:db8::1]:443", "2001:db8::1"},
		{"garbage edge header falls back to the peer", "not-an-ip", "", "198.51.100.4:443", "198.51.100.4"},
		{"nothing usable", "", "", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r, _ := http.NewRequest("POST", "/v1/web/start", nil)
			if c.realIP != "" {
				r.Header.Set("X-Real-IP", c.realIP)
			}
			if c.xff != "" {
				r.Header.Set("X-Forwarded-For", c.xff)
			}
			r.RemoteAddr = c.remote
			if got := FromRequest(r); got != c.want {
				t.Fatalf("FromRequest = %q, want %q", got, c.want)
			}
		})
	}
}
