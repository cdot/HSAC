/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env jquery */

/**
 * Informational dialog for use with data-with-info
 */
(function ($) {
    "use strict";

    function infoDialog(outputMsg, titleMsg) {
        var $element = $(this);

        if (!titleMsg)
            titleMsg = 'Alert';

        if (!outputMsg)
            outputMsg = 'No Message to Display.';

        $("<div></div>").html(outputMsg).dialog({
            title: titleMsg,
            resizable: true,
            modal: true,
            width: "100%",
            buttons: {
                "OK": function () {
                    $(this).dialog("close");
                }
            },
            close: function () {
                /* Cleanup node(s) from DOM */
                $(this).dialog('destroy').remove();
            }
        });
    }

    /**
     * An element with data-with-info will be displayed with an information
     * symbol which, when clicked, will bring up an infoDialog
     */
    $.fn.with_info = function (data) {
        var $thing = $(this);
        var i = data || $thing.data("with-info");
        if (i.charAt(0) === '#' && $(i).length === 0)
            throw "Missing " + i;

        var $icon = $("<span class='ui-icon ui-icon-info'></span>");
        $thing.after($icon);

        $icon.data("info", i);
        $icon.on("click", function () {
            var info = $(this).data("info");
            if (info.charAt(0) === '#')
                info = $(info).text();
            infoDialog(info, "Information");
        });
        return $thing;
    }
})(jQuery);