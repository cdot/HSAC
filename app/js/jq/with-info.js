/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env jquery */
/* global requirejs */

/**
 * Informational dialog for use with data-with-info. Requires jquery-confirm
 */
define([ "jquery" ], () => {

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
		if (typeof params !== "object")
			params = {
				text: params
			};

		function get_markdown(url) {
			if ($("#" + url).length > 0) {
				return Promise.resolve($("#" + url).innerHTML);
			}

			return new Promise(resolve => {
				$.ajax({
					url: url,
					data: {
						t: Date.now() // defeat cache
					},
					dataType: "text"
				})
				.done(md => {
					requirejs(["markdown-it"], function(Markdown) {
						const html = new Markdown({ html: true }).render(md);
            $("body").append("<div class='info hidden' id='"
                             + url + "'>"
                             + html + "</div>");
						resolve(html);
					});
				});
			});
		}
		
		for (let i = 0; i < this.length; i++) {
			const $thing = $(this[i]);
			const s = params.text || $thing.data("with-info");
			const position = params.position || $thing.data("with-info-position") ||
				    params.position || "after";

			if (typeof s === "undefined" || s.charAt(0) === '#' && $(s).length === 0) {
				console.error("INTERNAL ERROR: Missing with-info");
				throw "Missing " + s;
			}

			let $clickable;

			if (position === "hidden")
				$clickable = $thing;
			else if (position === "before") {
				if ($thing.next().is(".with-info-before"))
					$clickable = $thing.next();
				else {
					$clickable = $("<span class='fa fa-info-circle with-info-before'></span>");
					$thing.before($clickable);
				}
			} else if ($thing.next().is(".with-info-after"))
				$clickable = $thing.next();
			else {
				$clickable = $("<span class='fa fa-info-circle with-info-after'></span>");
				$thing.after($clickable);
			}

			$clickable.data("info", s);
			$clickable.on("click", function () {
				const source = $(this).data("info");
				let get_info = Promise.resolve();
				
				if (/\.md$/.test(source))
					// Construct HTML from external markdown
					get_info = get_markdown(source);
				else if (source.charAt(0) === '#')
					// HTML is embedded
					get_info = Promise.resolve($(source).html());
				else
					// HTML is in attribute
					get_info = Promise.resolve(source);
				
				get_info.then(html => {
					if (typeof params.bodyIcon === "undefined")
						html = "<div class='fa fa-info-circle with-info-icon'></div>" + html;
					else
						html = params.bodyIcon + html;

					// Alert using jquery-confirm
					$.alert({
						title: "",
						content: html,
						onOpen: function() {
							this.$content.find("[data-with-info]").with_info();
						}
					});
				});
			});
		}
	};
});
