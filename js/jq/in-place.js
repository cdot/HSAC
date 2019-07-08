/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env jquery */

/**
 * Simple in-place editing widgets
 */
(function ($) {
    "use strict";

    $.fn.edit_in_place = function (options) {

        var $this = $(this);
        var h = options.height || $this.innerHeight() || "1em";
        var w = options.width || $this.innerWidth() || "1em";
        var changed = options.changed ||
            function (text) {
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
            .css("height", h - 6)
            .css("width", w - 4)

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
                }
                return true;
            })

            .blur(blurb)
            .select();
    };

    $.fn.select_in_place = function (options) {

        var $ul = $("<ul class='sip_menu_ul'></ul>");
        var $div = $("<div class='sip_div'></div>");
        var $dlg = $("<div id='sip_menu'></div>");
        $div.append($ul);
        $dlg.append($div);
        $("body").append($dlg);

        var $this = $(this);
        var text = $this.text();

        for (var i = 0; i < options.options.length; i++) {
            var opt = options.options[i];
            var $opt = $("<li>" + opt + "</li>");
            if (opt === text) {
                $opt.addClass("ui-state-disabled");
                $opt[0].scrollIntoView();
            }
            $ul.append($opt);
        }

        $ul.menu({
            select: function (event, ui) {
                var val = ui.item.text();
                if (options.changed)
                    options.changed.call($this, val);
                $dlg.dialog("close");
            }
        });
        var vo = $this.offset();

        $dlg.dialog({
            modal: true,
            autoOpen: true,
            closeOnEscape: true,
            title: false,
            dialogClass: "sip_menu_dlg",
            position: {
                my: "left top",
                at: "left top",
                of: $this,
                collision: "none"
            },
            width: "auto",
            height: window.innerHeight - vo.top,
            resizable: false,
            draggable: false,
            open: function (event, ui) {
                // Blur when clicking outside the menu
                $(".ui-widget-overlay").on("click", function () {
                    $dlg.dialog("close");
                });
                $ul.select();
            },
            close: function () {
                $dlg.dialog("destroy");
                $dlg.remove();
            }
        });
    };
})(jQuery);