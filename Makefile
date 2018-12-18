# Copyright (C) 2018 Crawford Currie http://c-dot.co.uk / MIT
# Main targets are:
#
# make version - update the version number and defeat caches
# make tidy    - beautify code
# make clean   - remove intermediates and derived objects
# make lint    - run eslint

# Macros using shell commands
FIND      := find . -name 'jquery*' -prune -o -name
REVERSION := sed -e 's/BUILD_DATE/$(shell date)/g;s/\?version=[0-9]+/?version==$(shell date +%s)/g'
JS        := $(shell cat index.html | \
		grep '<script class="compressable" src=' $^ | \
		sed -e 's/.*src="//;s/[?"].*//g' )
CSS       := $(shell cat index.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/[?"].*//g' )

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

version:
	cat index.html | $(REVERSION) > tmp.html
	mv tmp.html index.html

min:	$(patsubst %.js,%.min.js,$(JS)) \
	$(patsubst %.js,%.map,$(JS)) \
	$(patsubst %.css,%.min.css,$(CSS))
	@echo "Made min"

index.html : $(JS)
	perl build/reversion.pl $@

# Clean generated stuff

clean:
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;
	rm $(patsubst %.js,%.min.js,$(JS))
	rm $(patsubst %.js,%.map,$(JS))
	rm $(patsubst %.css,%.min.css,$(CSS))

# Formatting

%.js.tidy : %.js
	js-beautify -j --good-stuff -o $^ $^

tidy: $(patsubst %.js,%.js.tidy,$(JS))

# eslint

%.esl : %.js
	-eslint $^ && touch $@

lint: $(patsubst %.js,%.esl,$(patsubst %.min.js,,$(JS)))



