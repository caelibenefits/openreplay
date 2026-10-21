package cacher

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	config "openreplay/backend/internal/config/assets"
	"openreplay/backend/pkg/logger"
	metrics "openreplay/backend/pkg/metrics/assets"
	"openreplay/backend/pkg/objectstorage"
	"openreplay/backend/pkg/url/assets"
)

// noStore never has the asset and accepts every upload.
type noStore struct{}

func (noStore) Upload(io.Reader, string, string, string, objectstorage.CompressionType) error {
	return nil
}
func (noStore) Get(string) (io.ReadCloser, error)              { return nil, nil }
func (noStore) Exists(string) bool                             { return false }
func (noStore) GetCreationTime(string) *time.Time              { return nil }
func (noStore) GetPreSignedUploadUrl(string) (string, error)   { return "", nil }
func (noStore) GetPreSignedDownloadUrl(string) (string, error) { return "", nil }
func (noStore) GetPreSignedDownloadUrlFromBucket(string, string) (string, error) {
	return "", nil
}
func (noStore) Tag(string, string, string) error { return nil }

func newTestCacher(t *testing.T) *cacher {
	t.Helper()
	cfg := &config.Config{
		Cache:                config.Cache{KeyScheme: assets.KeySchemeDaily},
		AssetsOrigin:         "https://assets.example/sessions-assets",
		AssetsSizeLimit:      1 << 20,
		AssetsRetries:        5,
		AssetsRetryBaseMs:    2000,
		AssetsRetryMaxMs:     60000,
		AssetsRetryHeapLimit: 100,
		AssetsFailureSuppMin: 60,
		AssetsPerHostLimit:   8,
		AssetsWorkerCount:    1,
		AssetsQueueSize:      1,
		AssetsHTTPTimeout:    5,
	}
	c, err := NewCacher(logger.New(), cfg, noStore{}, metrics.New("test"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Stop)
	return c
}

// scheduled reports the cacher's pending retries: how many, and the earliest.
func scheduled(c *cacher) (int, time.Time) {
	c.scheduler.mu.Lock()
	defer c.scheduler.mu.Unlock()
	if len(c.scheduler.heap) == 0 {
		return 0, time.Time{}
	}
	return len(c.scheduler.heap), c.scheduler.heap[0].at
}

func TestA404OnABuildAssetIsRetriedLater(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()
	c := newTestCacher(t)

	before := time.Now()
	c.cacheURL(&Task{requestURL: srv.URL + "/_next/static/chunks/0qoc3c2xzj6hq.css", host: "127.0.0.1",
		cachePath: "/k.20", urlContext: "test"})
	n, at := scheduled(c)
	if n != 1 {
		t.Fatalf("a 404 on a build asset scheduled %d retries, want 1", n)
	}
	if at.Before(before.Add(buildAssetRetryDelay)) {
		t.Fatalf("retry at %s, want no sooner than %s after the 404", at.Sub(before), buildAssetRetryDelay)
	}
}

func TestA404OnAnyOtherAssetIsPermanent(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()
	c := newTestCacher(t)

	c.cacheURL(&Task{requestURL: srv.URL + "/assets/site.css", host: "127.0.0.1",
		cachePath: "/k.20", urlContext: "test"})
	if n, _ := scheduled(c); n != 0 {
		t.Fatalf("a 404 outside /_next/static/ scheduled %d retries, want 0", n)
	}
}

func TestABuildAssetThatStays404GivesUpAndCanBeTriedAgain(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()
	c := newTestCacher(t)

	task := &Task{requestURL: srv.URL + "/_next/static/chunks/gone.css", host: "127.0.0.1",
		cachePath: "/gone.20", urlContext: "test", notFound: c.buildRetries - 1}
	c.timeoutMap.claim(task.cachePath)
	c.cacheURL(task)
	if n, _ := scheduled(c); n != 0 {
		t.Fatalf("the last attempt scheduled %d more retries, want 0", n)
	}
	// The terminal path frees the dedup entry after failureTTL, not a day.
	c.timeoutMap.mx.RLock()
	exp := c.timeoutMap.m[task.cachePath]
	c.timeoutMap.mx.RUnlock()
	if exp.After(time.Now().Add(c.failureTTL + time.Minute)) {
		t.Fatalf("dedup entry held until %s, want within %s", time.Until(exp), c.failureTTL)
	}
}

func TestABuildAsset404DoesNotSpendTheStatusRetryBudget(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()
	c := newTestCacher(t)

	task := &Task{requestURL: srv.URL + "/_next/static/chunks/a.css", host: "127.0.0.1",
		cachePath: "/a.20", urlContext: "test", attempt: c.maxAttempts - 1}
	c.cacheURL(task)
	if n, _ := scheduled(c); n != 1 || task.attempt != c.maxAttempts-1 {
		t.Fatalf("404 with the status budget spent: %d retries scheduled, attempt %d; want 1 and %d",
			n, task.attempt, c.maxAttempts-1)
	}
}

func TestCacheURLFreesABuildAssetsDedupWhenItStays404(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()
	c := newTestCacher(t)
	c.buildRetries = 1 // give up on the first 404, so the test needn't wait 5 minutes

	raw := srv.URL + "/_next/static/chunks/gone.css"
	c.CacheURL(1, raw)
	key := c.rewriter.CachePathForAssets(1, raw)
	deadline := time.Now().Add(5 * time.Second)
	for {
		c.timeoutMap.mx.RLock()
		exp, ok := c.timeoutMap.m[key]
		c.timeoutMap.mx.RUnlock()
		if ok && !exp.After(time.Now().Add(c.failureTTL+time.Minute)) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("dedup entry for %s still held until %s, want within %s", key, time.Until(exp), c.failureTTL)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestIsBuildAsset(t *testing.T) {
	for raw, want := range map[string]bool{
		"https://www.getcaeli.com/_next/static/chunks/a.css":         true,
		"https://www.getcaeli.com/_next/static/media/f.p.woff2":      true,
		"https://www.getcaeli.com/static/a.css":                      false,
		"https://cdn.example/proxy/_next/static/chunks/a.css":        false,
		"https://cdn.example/a.css?from=/_next/static/chunks/a.css":  false,
		"https://eurekaergonomic.com/cdn/shop/t/238/assets/base.css": false,
	} {
		if got := isBuildAsset(raw); got != want {
			t.Errorf("isBuildAsset(%q) = %v, want %v", raw, got, want)
		}
	}
}
