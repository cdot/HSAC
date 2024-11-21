/*@preserve Copyright (C) 2015-2024 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env jquery */
import "jquery";

/**
 * Attributes passed on to the editing box when passed in, or read from
 * the el being edited (passed in attrs override those on the object)
 */
const SUPPORTED_ATTRS = [
  "alt", "autocapitalize", "autocomplete",
  "dirname", "disabled", "height", "inputmode", "list", "max",
  "maxlength", "min", "minlength", "placeholder",
  "readonly", "size", "step", "type"
];

/**
 * Types supported for INPUT type=*
 */
const SUPPORTED_TYPES = [
  "date", "datetime-local", "email", "month", "number",
  "password", "range", "tel", "text", "time", "url", "week"
];

/**
 * Simple in-place editing widget, uses an INPUT to edit. Attributes
 * for the editing INPUT can also be passed using data-* e.g.
 * data-type="date" on the container.
 */
(function ($) {

  /**
   * Widget to edit a value in place using an input element.
   *
   * HTML
   * ```
   * <span id="editable">initial text</span>
   * <button id="edit_button" class="fa fa-pencil"></button>
   * ```
   *
   * Javascript
   * ```
   * $("#edit_button").on("click", () => {
   *   $("#editable").edit_in_place({
   *     changed: val => $("#editable").text(val),
   *     attrs: {
   *       type: "number", min: 0, max: 5
   *     }});
   * });
   * ```
   * @param {object?} options options
   * @param {number} options.height height of the editor
   * @param {number} options.width width of the editor
   * @param {function} options.changed function called when value is changed
   * @param {function} options.closed function called when edit is closed
   * @param {string} options.text string to override text content of the
   * element being edited.
   * @param {object} options.attrs object containing standard input attributes
   * that will be added to the input element.
   */
  $.fn.edit_in_place = function (options = {}) {

    const $this = $(this);
    
    const h = options.height || $this.innerHeight() || "1em";
    const w = options.width || $this.innerWidth() || "1em";

    const changed = options.changed || function() { return $this.text(); };
    const closed = options.closed || function () {};
    let text = options.text || $this.text();
    const $input = $(`<input/>`);
    let attrs = {};
    for (const a of SUPPORTED_ATTRS) {
      if ($this.data(a))
        attrs[a] = $this.data(a);
    }

    if (options.attrs)
      attrs = $.extend(attrs, options.attrs);
    
    if (typeof attrs.type === "string")
      if (SUPPORTED_TYPES.indexOf(attrs.type) < 0)
        throw new Error(`Unsupported type="${attrs.type}"`);

    for (const attr of Object.keys(attrs))
      $input.attr(attr, attrs[attr]);

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
      // no change event from color :-(
      const val = $(this)
            .val();
      blurb();
      if (val !== text)
        text = changed.call($this, val);
    })

    .on("keydown", function (e) { // Escape means cancel
      if (e.keyCode === 27 ||
          (e.keyCode === 13 && $(this).val() === text)) {
        blurb();
        return false;
      }
      return true;
    })

    .blur(blurb)
    .select();
  };

})(jQuery);

export { SUPPORTED_ATTRS, SUPPORTED_TYPES }
