/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env jquery */

/**
 * Informational dialog for use with data-with-info. Requires jquery-confirm
 */
(function ($) {
    "use strict";

    /**
     * An element with data-with-info will be displayed with an information
     * symbol which, when clicked, will bring up an infoDialog. if noIcon is
     * set, then the item itself will be made clickable.
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

        if (typeof s === "undefined" || s.charAt(0) === '#' && $(s).length === 0)
            throw "Missing " + s;

        var $clickable;

        if (params.noIcon)
            $clickable = $thing;
        else {
            $clickable = $("<span class='ui-icon ui-icon-info'></span>");
            $thing.after($clickable);
        }

        $clickable.data("info", s);
        $clickable.on("click", function () {
            var info = $(this).data("info");
            if (info.charAt(0) === '#')
                info = $(info).html();
            $.alert({
                title: "",
                content: info
            });
        });
    }
})(jQuery);