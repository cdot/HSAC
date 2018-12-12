/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Simple in-place editing widget
 */
(function ($) {
    "use strict";
    $.fn.edit_in_place = function (options) {

        var $this = $(this);
        var h = options.height || $this.parent().innerHeight() || "1em";
        var w = options.width || $this.parent().innerWidth() || "1em";
        var changed = options.changed ||
            function ( /*text*/ ) {
                return $this.text();
            };
        var closed = options.closed || function () {};
        var $input = $(document.createElement("input"));
        var text = options.text || $this.text();

        // Action on blur
        function blurb() {
            $input.remove();
            $this.show();
            closed();
        }

        $this.hide();

        $input
            .insertBefore($this)
            .addClass("in_place_editor")
            .val(text)
            .css("height", h)
            .css("width", w)

            .on("change", function () {
                var val = $(this)
                    .val();
                blurb();
                if (val !== text)
                    text = changed.call($this, val);
            })
            .on("keydown", function (e) { // Escape means cancel
                if (e.keyCode === 27 ||
                    (e.keyCode === 13 &&
                        $(this)
                        .val() === text)) {
                    blurb();
                    return false;
                } else
                    return true;
            })

            .blur(blurb)
            .select();
    };

    $.fn.select_in_place = function (options) {

        var $this = $(this);
        var h = options.height || $this.parent().innerHeight() || "1em";
        var w = options.width || $this.parent().innerWidth() || "1em";
        var changed = options.changed ||
            function ( /*text*/ ) {
                return $this.text();
            };
        var closed = options.closed || function () {};
        var $select = $(document.createElement("select"));
        var text = options.text || $this.text();

        for (var i = 0; i < options.options.length; i++) {
            var $opt = $("<option>" + options.options[i] + "</option>");
            if (options.options[i] == options.initial)
                $opt.attr("selected", "selected");
            $select.append($opt);
        }

        // Action on blur
        function blurb() {
            $select.remove();
            $this.show();
            closed();
        }

        $this.hide();

        $select
            .insertBefore($this)
            .addClass("in_place_editor")
            .css("height", h)
            .css("width", w)

            .on("change", function () {
                var val = $(this)
                    .val();
                blurb();
                if (val !== text)
                    text = changed.call($this, val);
            })
            .on("keydown", function (e) { // Escape means cancel
                if (e.keyCode === 27 ||
                    (e.keyCode === 13 &&
                        $(this)
                        .val() === text)) {
                    blurb();
                    return false;
                } else
                    return true;
            })

            .blur(blurb)
            .select();
    };
})(jQuery);
