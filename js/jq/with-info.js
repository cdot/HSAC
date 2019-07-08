/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env jquery */

/**
 * Informational dialog for use with data-with-info. Requires jquery-confirm
 */
(function ($) {
    "use strict";

    /**
     * An element with data-with-info will be displayed with an information
     * symbol which, when clicked, will bring up an info dialog.
     * @param text the info text. If it starts with #, the id of the
     * container to get the text from
     * @param bodyIcon: optional html fragment overriding the icon in
     * the alert. Set empty to disable the icon.
     * @param position "hidden" to hide the icon, "before" to place
     * the icon before the element, "after" otherwise. Can also give
     * data-with-info-position on the element.
     */
    $.fn.with_info = function (params) {
        if (this.length === 0)
            return;

        if (typeof params !== "object")
            params = {
                text: params
            };

        var $thing = $(this);
        var s = params.text || $thing.data("with-info");
        var position = params.position || $thing.data("with-info-position") ||
            params.position || "after";

        if (typeof s === "undefined" || s.charAt(0) === '#' && $(s).length === 0)
            throw "Missing " + s;

        var $clickable;

        if (position === "hidden")
            $clickable = $thing;
        else if (position === "before") {
            $clickable = $("<span class='fas fa-info-circle with-info-before'></span>");
            $thing.before($clickable);
        } else {
            $clickable = $("<span class='fas fa-info-circle with-info-after'></span>");
            $thing.after($clickable);
        }

        $clickable.data("info", s);
        $clickable.on("click", function () {
            var info = $(this).data("info");
            if (info.charAt(0) === '#')
                info = $(info).html();
            if (typeof params.bodyIcon === "undefined")
                info = "<div class='fas fa-info-circle with-info-icon'></div>" + info;
            else
                info = params.bodyIcon + info;
            $.alert({
                title: "",
                content: info
            });
        });
    }
})(jQuery);