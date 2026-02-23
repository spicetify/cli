package utils

import (
	"net/http"
	"time"
)

// HTTPClient is a shared HTTP client with a reasonable timeout.
// Using the default http.Get has no timeout and can hang indefinitely.
var HTTPClient = &http.Client{Timeout: 30 * time.Second}
