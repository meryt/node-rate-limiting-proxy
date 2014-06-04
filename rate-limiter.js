/**
 * Rate-limiting proxy, limits certain resources to N requests per minute.
 *
 * Resources are identified based on the function you specify in config.js
 *
 * Requires Redis running on localhost (same machine as this script)
 *
 */

var http = require('http');

var httpProxy = require('http-proxy');
var c = require('./config');
var redback = require('redback').createClient(c.REDIS_PORT, c.REDIS_HOST),
ratelimit = redback.createRateLimit('requests', {
    bucket_interval: 60,
    bucket_span: 180,
    subject_expiry: 180
});

console.log("Redis-backed rate-limiting proxy listening on port " + c.RL_PORT);
console.log("Forwarding to " + c.RL_API_URL);
console.log();

var options = {
    target: c.RL_API_URL
}

// Create a simple proxy server that proxies to our target URL
var proxy = httpProxy.createServer(options);

// Before forwarding the request, replace the "Host" header with the remote host that we are proxying to.
proxy.before('web', 'stream', function(req, res, options) { req.headers.host = options.target.host; });

// Create a Web server that will respond on our port and handle requests and
// responses, proxying through to the target if the request is not rate-limited.
var server = http.createServer(function(req, res) {

    var api_key = typeof(req.headers[c.RL_API_KEY_HEADER.toLowerCase()]) == "undefined"
        ? ''
        : req.headers[c.RL_API_KEY_HEADER.toLowerCase()];

    var rateLimitedResource = c.getRateLimitedResource(req);

    if (rateLimitedResource) {

        // Abort if there is no API key given.
        if (api_key == '') {
            logRequest(400, '', '', 0, 0);

            var body = '{"type": "API_KEY_REQUIRED", "message": "The api_key header was not present."}';
            res.writeHead(400,{
                'Content-Length': body.length,
                'Content-Type': 'application/json'
            });
            res.write(body);
            res.end('');
            return;
        }

        var tableLookupKey = api_key + ":" + rateLimitedResource;

        // Increment the hit count to the resource
        ratelimit.add(tableLookupKey);

        // Find out how many requests we have made in this 60-second window
        ratelimit.count(tableLookupKey, 60, function (err, count) {

            if (typeof(err) != "undefined" && err != null) {
                logRequest(500, api_key, rateLimitedResource, 0, 0);
                logError(err);
                var err_body = '{"type": "SERVER_ERROR", "message": "An error occurred attempting to check the rate limit"}';
                res.writeHead(500,{
                    'Content-Length': err_body.length,
                    'Content-Type': 'application/json'
                });
                res.write(err_body);
                res.end('');
                return;
            }

            var windowExpiration = getExpiry();
            var remaining = c.RL_LIMIT_LIMIT - count;
            remaining = remaining < 0 ? 0 : remaining;

            if (count > c.RL_LIMIT_LIMIT) {

                // If we've exceeded our limit, don't proxy the request, just respond
                // with a 429.

                logRequest(429, api_key, rateLimitedResource, 0, windowExpiration);
                var err_body = '{"type": "RATE_LIMIT_EXCEEDED", "message": '
                    + '"You have attempted to access a rate limited resource. This resource will be available to receive requests again in '
                    + windowExpiration + ' seconds."}';
                res.writeHead(429,{
                    'Content-Length': err_body.length,
                    'Content-Type': 'application/json',
                    'X-Rate-Limit-Limit': c.RL_LIMIT_LIMIT,
                    'X-Rate-Limit-Remaining': remaining,
                    'X-Rate-Limit-Reset': windowExpiration
                });

                res.write(err_body);
                res.end('');

            } else {
                // We will proxy the request but we want to extend the writeHead function
                // to add our rate-limit headers to the web server's response
                res.oldWriteHead = res.writeHead;
                res.writeHead = function(statusCode, headers) {
                      res.setHeader('X-Rate-Limit-Limit', c.RL_LIMIT_LIMIT);
                      res.setHeader('X-Rate-Limit-Remaining', remaining);
                      res.setHeader('X-Rate-Limit-Reset', windowExpiration);
                      logRequest(statusCode, api_key, rateLimitedResource, remaining, windowExpiration);
                      res.oldWriteHead(statusCode, headers);
                }

                proxy.web(req, res);
            }
        });
    } else {
        // The resource is not rate-limited -- just send it along.
        logRequest('---', api_key, '', 0, 0);
        proxy.web(req, res);
    }
});

// Start the server
server.listen(c.RL_PORT);


//*****************************************************************************
// Utility functions.
//*****************************************************************************

function timestamp() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

function logError(err) {
    console.log('[' + timestamp() + '] 500 -- ERROR ', err);
}

function logRequest(httpStatus, apikey, resource, remainingHits, windowExpirySeconds) {
    var rateLimitString = ' (resource not rate-limited)';
    if (apikey == '' || apikey == null) {
        apikey = '(not specified)';
    }
    if (resource != null && resource != '') {
        rateLimitString = ' has ' + remainingHits + ' requests remaining to ' + resource + ' resource in next ' + windowExpirySeconds + ' seconds';
    }
    console.log('[' + timestamp() + '] ' + httpStatus + ' -- API Key ' + apikey + rateLimitString);
}

/**
 * Our windows are simply sixty-second blocks of time starting at :00 and ending
 * at :59, inclusive.  We can thus determine how many seconds remain in the current
 * window by looking at the current timestamp modulo 60.
 */
function getExpiry() {
    var time = (time || new Date().getTime()) / 1000;
    return 60 - Math.floor(time % 60);
}

