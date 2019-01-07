# Copyright (C) 2018 Crawford Currie http://c-dot.co.uk / MIT
# Main targets are:
#
# make version - update the version number to defeat caches
# make clean   - remove intermediates and derived objects
# make lint    - run eslint

# Macros using shell commands
FIND      := find . -name 'jquery*' -prune -o -name
REVERSION := sed -e 's/\?version=[0-9]+/?version=$(shell date +%s)/g'
JS        := $(shell cat index.html | \
		grep '<script class="compressable" src=' $^ | \
		sed -e 's/.*src="//;s/[?"].*//g' )
CSS       := $(shell cat index.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/[?"].*//g' )

%.map %.min.js : %.js
	babel-minify \
		--comments \
		-o $@ \
		-- $^

%.min.css : %.css
	cleancss $^ > $@

%.min.html : %.html
	cat $^ | \
	sed -E -e 's/class="compressable" ([^.]*)\.([a-z]+)"/\1.min.\2"/g' > $@

%.map : %.min.js

%.html: %.md
	echo '<!DOCTYPE html>' > $@
	echo '<html><head>' >> $@
	echo '<script src="libs/jquery.min.js"></script>' >> $@
	echo '<script src="libs/jquery.toc/jquery.toc.min.js"></script>' >> $@
	echo '<style>body{font-family: "Trebuchet MS", Helvetica, sans-serif;}</style>' >> $@
	echo '</head>' >> $@
	echo '<title>Sheds</title>' >> $@
	echo '<body>' >> $@
	marked $^ >> $@
	echo "</body></html>" >> $@

doc: README.html

version:
	sed -e 's/\?version=[0-9]*/?version=$(shell date +%s)/g' index.html \
	| sed -e 's/BUILD_DATE .*-/BUILD_DATE $(shell date) --/g' index.html \
	> tmp.html
	mv tmp.html index.html

min:	$(patsubst %.js,%.min.js,$(JS)) \
	$(patsubst %.js,%.map,$(JS)) \
	$(patsubst %.css,%.min.css,$(CSS))
	@echo "Made min"

# Clean generated stuff

clean:
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;
	rm -f $(patsubst %.js,%.min.js,$(JS)) \
		$(patsubst %.js,%.map,$(JS)) \
		$(patsubst %.css,%.min.css,$(CSS))

# Formatting

%.js.tidy : %.js
	js-beautify -j --good-stuff -o $^ $^

tidy: $(patsubst %.js,%.js.tidy,$(JS))

# eslint

%.esl : %.js
	-eslint $^ && touch $@

lint: $(patsubst %.js,%.esl,$(patsubst %.min.js,,$(JS)))



