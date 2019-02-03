# Copyright (C) 2018 Crawford Currie http://c-dot.co.uk / MIT
# Main targets are:
#
# make version - update the version number to defeat caches
# make clean   - remove intermediates and derived objects
# make lint    - run eslint

TMP       := /tmp/
FIND      := find . -name 'jquery*' -prune -o -name
JS        := $(shell cat index.html | \
		grep '<script .*src="js/' $^ | \
		sed -e 's/.*src="//;s/[?"].*//g' )
CSS       := $(shell cat index.html | \
		grep '<link .*href="css/' $^ | \
		sed -e 's/.*href="//;s/[?"].*//g' )
LIB_FONTS := $(shell find libs -name '*.woff*' -o -name '*.ttf')
LIB_IMGS  := $(shell find libs -name '*.png' -o -name '*.gif')
LIB_MINS  := $(shell find libs -name '*.min.js' -o -name '*.min.css')
LIBS      := $(LIB_FONTS) $(LIB_IMGS) $(LIB_MINS)
IMAGES    := $(shell find images -name '*.png' -o -name '*.ico')

%.html: %.md
	echo '<!DOCTYPE html>' > $@
	echo '<html><head>' >> $@
	echo '<script src="libs/jquery.min.js"></script>' >> $@
	echo '<script src="libs/jquery.toc/jquery.toc.min.js"></script>' >> $@
	echo '<link href="libs/fontawesome/css/solid.css" rel="stylesheet">' >> $@
	echo '<link href="libs/fontawesome/css/fontawesome.css" rel="stylesheet">' >> $@
	echo '<style>body{font-family: "Trebuchet MS", Helvetica, sans-serif;}</style>' >> $@
	echo '</head>' >> $@
	echo '<title>Sheds</title>' >> $@
	echo '<body>' >> $@
	marked $^ >> $@
	echo "</body></html>" >> $@

doc: README.html

# Get a list of interesting files from index.html (the ones with ?version=)
# and use git log to get the latest checked-in date
reversion:
	@INTERESTING=`grep -P '\?version=[a-f0-9]*' index.html | sed -e 's/^.*\(src\|href\)="//;s/\?version.*//'`;\
	for c in $$INTERESTING; do \
		DATE=`git log -n 1 $$c | grep Date | sed -e 's/Date: *//;s/ +0.*//'`; \
		DATE=`date -d "$$DATE" +%s`; \
		#echo "GIT: $$c: $$DATE" ;\
		sed -e "s#$$c?version=[0-9]*#$$c?version=$$DATE#" index.html > $(TMP)index.html;\
		diff $(TMP)index.html index.html || mv $(TMP)index.html index.html; \
	done

# Use git status to get a list of locally changed files and update the version
# identifier in index.html. Used during development only.
version:
	@CHANGED=`git status -s --porcelain | grep -v "\?" | sed -e 's/^...//;'`;\
	for c in $$CHANGED; do \
		export DATE=`stat -c %Y $$c`; \
		#echo "STAT: $$c: $$DATE" ;\
		sed -e "s#$$c?version=[0-9]*#$$c?version=$$DATE#" index.html > $(TMP)index.html;\
		diff index.html $(TMP)index.html || echo $$c && mv $(TMP)index.html index.html; \
	done

# Clean generated stuff

clean:
	rm -rf release
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;
	rm -f $(patsubst %.js,%.min.js,$(JS)) \
		$(patsubst %.js,%.map,$(JS)) \
		$(patsubst %.css,%.min.css,$(CSS))

# Formatting

%.js.tidy : %.js
	js-beautify -j --good-stuff -o $^ $^

tidy : $(patsubst %.js,%.js.tidy,$(JS))

# eslint

%.esl : %.js
	-eslint $^ && touch $@

lint : $(JS:%.js=%.esl)

# release

release/%.js : %.js
	@mkdir -p $(@D)
	node_modules/.bin/babel $< -o $@

release/%.css : %.css
	@mkdir -p $(@D)
	cp $< $@

release/%.html : %.html
	@mkdir -p $(@D)
	sed -e 's/<!--babel\(.*\)-->/<script\1>/' $< > $@

release/libs/polyfill.min.js : node_modules/@babel/polyfill/dist/polyfill.min.js
	@mkdir -p $(@D)
	cp $< $@

release/%.png : %.png
	@mkdir -p $(@D)
	cp $< $@

release/%.gif : %.gif
	@mkdir -p $(@D)
	cp $< $@

release/%.ico : %.ico
	@mkdir -p $(@D)
	cp $< $@

release/%.woff : %.woff
	@mkdir -p $(@D)
	cp $< $@

release/%.woff2 : %.woff2
	@mkdir -p $(@D)
	cp $< $@

release/%.ttf : %.ttf
	@mkdir -p $(@D)
	cp $< $@

release : version \
	release/libs/polyfill.min.js \
	$(JS:%=release/%) \
	$(CSS:%=release/%) \
	$(LIBS:%=release/%) \
	$(IMAGES:%=release/%) \
	release/index.html \
	release/README.html
