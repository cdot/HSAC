# Copyright (C) 2018 Crawford Currie http://c-dot.co.uk / MIT
# Main targets are:
#
# make test    - run unit tests
# make release - build all derived objects
# make tidy    - beautify code
# make clean   - remove intermediates and derived objects
# make lint    - run eslint
# make langs   - update all translations

# Macros using shell commands
FIND      := find . -name 'jquery*' -prune -o -name
DATE_SED  := sed -e 's/BUILD_DATE/$(shell date)/g'
SHEDS_JS  := $(shell cat Sheds.html | \
		grep '<script class="compressable" src=' $^ | \
		sed -e 's/.*src="//;s/[?"].*//g' )
SHEDS_CSS := $(shell cat Sheds.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/[?"].*//g' )

STORES_JS := $(wildcard js/*Store.js)
TESTS_JS  := $(wildcard js/test/*.js test/*.js)

%.map %.min.js : %.js
	uglifyjs \
		--comments \
		--compress \
		-o $@ \
		-- $^

%.min.css : %.css
	cleancss $^ > $@

%.min.html : %.html
	cat $^ | \
	sed -E -e 's/class="compressable" ([^.]*)\.([a-z]+)"/\1.min.\2"/g' > $@

%.map : %.min.js

min:	$(patsubst %.js,%.min.js,$(SHEDS_JS) $(STORES_JS)) \
	$(patsubst %.js,%.map,$(SHEDS_JS) $(STORES_JS)) \
	$(patsubst %.css,%.min.css,$(SHEDS_CSS))
	@echo "Made min"

Sheds.html : $(SHEDS_JS)
	perl build/reversion.pl $@

# Release 
# 1. Combining all the non-store js in the order it is included in the HTML
#    into a single minified file
# 2. Combining all the css (in the order it is included in the HTML) into a
#    single minified file
# Note that the stores are minified but not concatenated
release/js/Sheds.min.js : $(SHEDS_JS)
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

release/js/help.min.js : $(HELP_JS)
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

release/js/%Store.js : js/%Store.js
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

release/css/Sheds.min.css : $(SHEDS_CSS)
	@mkdir -p release/css
	cat $^ | cleancss -o $@

release/css/help.min.css : $(HELP_CSS)
	@mkdir -p release/css
	cat $^ | cleancss -o $@t

release/images/% : images/%
	@mkdir -p release/images
	cp $^ $@

release/%.html : %.html build/release.sed Makefile
	@mkdir -p release
	cat Sheds.html \
	| $(DATE_SED) \
	| sed -E -f build/release.sed \
	> $@

release: release/Sheds.html release/help.html \
	release/js/help.min.js release/css/Sheds.min.css \
	release/js/Sheds.min.js release/css/Sheds.min.css \
	$(patsubst %.js,%.min.js,$(patsubst js/%,release/js/%,$(STORES_JS))) \
	$(patsubst images/%,release/images/%,$(wildcard images/*))
	@-rm -f release/js/*.map
	@echo $^ built

# Minified - halfway to release
minified/%.html : %.html Makefile
	@mkdir -p minified
	cp Sheds.html $@

minified/js/%.js : js/%.js
	@mkdir -p minified/js
	uglifyjs \
		--comments \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

minified/libs/%.js : libs/%.js
	@mkdir -p minified/libs
	cp $^ $@

minified/css/%.css : css/%.css
	@mkdir -p minified/css
	cat $^ | cleancss -o $@

minified/images/% : images/%
	@mkdir -p minified/images
	cp $^ $@

minified: minified/Sheds.html minified/help.html \
	$(patsubst js/%.js,minified/js/%.js,$(SHEDS_JS)) \
	$(patsubst libs/%.js,minified/libs/%.js,$(SHEDS_JS)) \
	$(patsubst js/%.js,minified/js/%.js,$(HELP_JS)) \
	$(patsubst js/%.js,minified/js/%.js,$(STORES_JS)) \
	$(patsubst css/%.css,minified/css/%.css,$(SHEDS_CSS)) \
	$(patsubst css/%.css,minified/css/%.css,$(HELP_CSS)) \
	$(patsubst images/%,minified/images/%,$(wildcard images/*))

# Languages

langs : $(LANGS)

# Tests

test:
	mocha $(TESTS_JS)

# Clean generated stuff

clean:
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND)  '*.min.*' -exec rm \{\} \;
	$(FIND) '*.map' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;
	$(FIND) '*.strings' -exec rm \{\} \;

# Formatting

%.js.tidy : %.js
	js-beautify -j --good-stuff -o $^ $^

tidy: $(patsubst %.js,%.js.tidy,$(SHEDS_JS) $(STORES_JS) $(SERVER_JS))

# eslint

%.esl : %.js
	-eslint $^ && touch $@

lint: $(patsubst %.js,%.esl,$(patsubst %.min.js,,$(SHEDS_JS) $(STORES_JS) $(SERVER_JS)))

# debug, keep .strings files around
#.SECONDARY: $(patsubst %.js,%.js.strings,$(SHEDS_JS) $(STORES_JS)) Sheds.html.strings help.html.strings


