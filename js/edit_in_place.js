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

        var $dlg = $("#sip_menu");
        if ($dlg.length == 0) {
            $dlg = $("<div id='sip_menu'><ul></ul></div>");
            $("body").append($dlg);
            $dlg.dialog({
                modal: false,
                autoOpen: false,
                closeOnEscape: true,
                title: false,
                dialogClass: "sip_menu_dlg",
                width: "auto",
                height: "auto",
                resizable: false,
                draggable: false,
                position: {
                    my: "left top", at: "left top"
                },
                open: function (event, ui) {
                    $(".ui-widget-overlay").on("click", function () {
                        $("#dialog").dialog("close");
                    });
                }
            });
        }
        var $ul = $dlg.children("ul");
 
        var changed = options.changed ||
            function ( /*text*/ ) {
                return $this.text();
            };
        var closed = options.closed || function () {};
        
        // Action on blur
        function blurb() {
            $dlg.dialog("close");
            closed();
        }

        var $this = $(this);
        var text = $this.text();
        $ul.empty();
        for (var i = 0; i < options.options.length; i++) {
            var $opt = $("<li>" + options.options[i] + "</li>");
            if (options.options[i] === text)
                $opt.addClass("ui-state-disabled");
            $ul.append($opt);
        }
        $dlg.dialog("option", "maxHeight", $("body").height() - 10);
        $dlg.dialog("option", "position.of", $this);
        $ul.menu({
            select: function (event, ui) {
                var val = ui.item.text();
                blurb();
                text = changed.call($this, val);
            }
        }).blur(blurb);
        $dlg.dialog("open");
        $ul.select();
    };
})(jQuery);
