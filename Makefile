#
# Remember to set your text editor to use 4 size non-soft tabs.
#

.PHONY : run clean install

# Start the server:
run:
	node rate-limiter.js

install: node_modules

node_modules:
	npm install

clean:
	rm -rf node_modules
