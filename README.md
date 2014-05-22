node-rate-limiting-proxy
========================

Redis-backed per-API-key rate-limiting proxy server

## Purpose

This is a simple forwarding proxy that simulates a rate-limiter sitting between the client and the server.  It is intended for development use only.

It keeps track of requests-per-minute to specified resources and refuses access with a 429 status once a hard-coded rate limit (configurable in config.js) has been reached.  It also adds HTTP headers to provide rate-limiting information to the client.

The rate-limiting scheme uses a fixed window of 60 seconds which resets at the top of every minute.  Thus if your first request comes at 00:00:55 you will have (N-1) requests remaining and 5 seconds until the counter resets.  If it comes at 00:00:00 you will have (N-1) requests remaining and 60 seconds until the counter resets.

## Usage

Once the server is running, you will point your client at the proxy's port (default 4000) rather than the application port (default 8888).  The proxy will forward all requests along to the application, unless it is a rate-limited resource and the rate limit has been hit.

The client must send a header with a unique API key using the header name specified under the RL_API_KEY_HEADER config variable.  (This defaults to 'api_key'.)  Failure to do so will cause the request to be rejected with a 400 status.

The proxy server will add the following headers:

* X-Rate-Limit-Limit -- the rate limit per minute for this resource
* X-Rate-Limit-Remaining -- the number of requests remaining to this resource in this window
* X-Rate-Limit-Reset -- the number of seconds until the window resets

## Installation

These instructions assume you already have redis installed and running on localhost with respect to these scripts, and that you already have node.js and npm.

1. Clone this repo
2. Change any settings in config.js for your environment
3. To install the dependencies:    npm install
4. To start the proxy server:    make s

