
module.exports = {
  // Currently ignored
  RL_NODE_ENV: 'development',

  // Proxy listens on this port. Hit this port to be forward to RL_API_URL
  RL_PORT: 4000,

  // Requests to me at port RL_PORT will be forwarded here
  RL_API_URL: 'http://localhost:8888',

  // How many requests per minute
  RL_LIMIT_LIMIT: 5,

  // What header is used to identify the client
  // If header not included (and resource is rate-limited),
  // will fail with HTTP 400 status.
  RL_API_KEY_HEADER: 'api_key'
}

// Override any values with env variables
for(var key in module.exports) {
  module.exports[key] = process.env[key] || module.exports[key];
}

/**
 * Maps a given request to a rate-limited resource name,
 * or null if the resource is not rate-limited.
 *
 * It is up to you to classify the resource based on the URL, HTTP method,
 * or whatever.  To rate-limit all requests from the same pool, just return
 * the same string every time.
 */
module.exports.getRateLimitedResource = function(req) {
    if (!(req.url.match('reapi'))) {
        return null;
    }
    if (req.url.match('home')) {
        return 'Home';
    }
    if (req.url.match('engines') && req.url.match('forms') && req.method == 'POST') {
        return 'FormEnginePost';
    }
    return null;
}
