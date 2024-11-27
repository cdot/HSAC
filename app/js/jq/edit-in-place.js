/*@preserve Copyright (C) 2015-2024 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env jquery */
import "jquery";

/**
 * Supported data- attributes on the el being edited, or passed in
 * options.attrs (passed in options.attrs override those on the el)
 */
const SUPPORTED_ATTRS = [
  "autocapitalize", "max", "maxlength", "min", "minlength",
  "placeholder", "size", "step", "type", "value"
];

/**
 * Types supported for INPUT type=*, specified by { attrs: { type: }}
 * or data-type= on the el
 * Note that "color" type inputs don't work on Firefox 131.0.3
 */
const SUPPORTED_TYPES = [
  "color", "date", "datetime-local", "email", "month", "number",
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
   * <span id="editable" data-type="text">initial text</span>
   * ```
   *
   * Javascript
   * ```
   * $("#editable").on("click", function() {
   *   $(this).edit_in_place({
   *     changed: val => $("#editable").text(val),
   *     attrs: {
   *       type: "number", min: 0, max: 5
   *     }});
   * });
   * ```
   * @param {object} options options
   * @param {number} options.height height of the editor
   * @param {number} options.width width of the editor
   * @param {function} options.changed function called when value is changed
   * @param {function} options.closed function called when edit is closed
   * @param {object} options.attrs object containing standard input attributes
   * that will be added to the input element. Anything passed in attrs
   * overrides what may come from the data- attributes on the element.
   * @param {string} options.attrs.autocapitalize
   * @param {number|string} options.attrs.max
   * @param {number} options.attrs.maxlength
   * @param {number|string} options.attrs.min
   * @param {number} options.attrs.minlength
   * @param {string} options.attrs.placeholder
   * @param {number} options.attrs.size
   * @param {number} options.attrs.step
   * @param {string} options.attrs.type
   * @param {number|string|Date} options.attrs.value
   */
  $.fn.edit_in_place = function (options = {}) {
    const editElement = this;
    const $editElement = $(editElement);
    
    const h = options.height || $editElement.innerHeight() || "1em";
    const w = options.width || $editElement.innerWidth() || "1em";

    const changed = options.changed || function() { return $editElement.text(); };
    const closed = options.closed || function () {};

    let attrs = {};
    for (const a of SUPPORTED_ATTRS) {
      if ($editElement.data(a))
        attrs[a] = $editElement.data(a);
    }
    let val = attrs.value || $editElement.text();

    if (options.attrs) {
      for (const a of SUPPORTED_ATTRS) {
        if (a in options.attrs)
          attrs[a] = options.attrs[a];
      }
    }
    
    const $input = $("<input/>");
    if (typeof attrs.type === "string") {
      if (SUPPORTED_TYPES.indexOf(attrs.type) < 0)
        throw new Error(`Unsupported type="${attrs.type}"`);
      if (attrs.type === "date" || attrs.type === "datetime-local") {
        const dval = new Date(val);
        dval.setMinutes(dval.getMinutes() - dval.getTimezoneOffset());
        // e.g. 1815-06-18T12:32
        val = dval.toISOString().slice(0, attrs.type === "date" ? 10 : 16);
        attrs.value = val;
      }
    }
    
    for (const attr of Object.keys(attrs))
      $input.attr(attr, attrs[attr]);

    // Action on blur
    function blurb() {
      $input.remove();
      $editElement.show();
      closed();
    }

    $editElement.hide();

    $input
    .insertBefore($editElement)
    .addClass("in_place_editor")
    .val(val)
    .css("height", h - 6)
    .css("width", w - 4)

    .on("change", function () {
      //console.debug("CHANGE");
      const nval = $(this).val();
      if (nval != val) {
        $editElement.text(nval);
        changed.call(editElement, nval);
      }
      switch (attrs.type) {
      case "color": case "date": case "datetime-local":
        // These types fire change events mid-selection
        break;
      default:
        // Other types fire change events at the end of the edit
        blurb();
      }
    })

    .on("blur", blurb)
    
    .on("keydown", function (e) { // Escape means cancel
      if (e.keyCode === 27) {
        blurb();
        return false;
      }
      return true;
    })

    .focus();
  };

})(jQuery);

export { SUPPORTED_ATTRS, SUPPORTED_TYPES }
