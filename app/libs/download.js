/**
* Download all required libraries. These have to be checked in to git,
* so we can load the app when there is no internet connection and the
* browser cache is empty.
*/

const request = require('request-promise');
const Fs = require('fs-extra');

const JQUERY = "https://code.jquery.com/";
const CLOUDFLARE = "https://cdnjs.cloudflare.com/ajax/libs/";
const JSDELIVR = "https://cdn.jsdelivr.net/npm/";
const JQUERY_UI = JQUERY + "ui/1.12.1";
const JQUERY_UI_THEME = JQUERY_UI + "/themes/smoothness";

function get(url, file) {
    console.log("rm",file);
    return request({
        encoding: null,
        uri: url
    })
    .then((content) => {
        return Fs.writeFile(file, content);
    })
    .catch((e) => {
        console.error("Error fetching", url,e);
    });
}

let files = [
    {
        target: "js.cookie",
        url: CLOUDFLARE + "js-cookie/2.2.0/js.cookie",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "additional-methods",
        url: CLOUDFLARE + "jquery-validate/1.19.1/additional-methods",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery-ui/images/ui-bg_glass_55_fbf9ee_1x400",
        url: JQUERY_UI_THEME + "/images/ui-bg_glass_55_fbf9ee_1x400",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-bg_glass_65_ffffff_1x400",
        url: JQUERY_UI_THEME + "/images/ui-bg_glass_65_ffffff_1x400",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-bg_glass_75_dadada_1x400",
        url: JQUERY_UI_THEME + "/images/ui-bg_glass_75_dadada_1x400",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-bg_glass_75_e6e6e6_1x400",
        url: JQUERY_UI_THEME + "/images/ui-bg_glass_75_e6e6e6_1x400",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-bg_glass_95_fef1ec_1x400",
        url: JQUERY_UI_THEME + "/images/ui-bg_glass_95_fef1ec_1x400",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-bg_highlight-soft_75_cccccc_1x100",
        url: JQUERY_UI_THEME + "/images/ui-bg_highlight-soft_75_cccccc_1x100",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-icons_222222_256x240",
        url: JQUERY_UI_THEME + "/images/ui-icons_222222_256x240",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-icons_2e83ff_256x240",
        url: JQUERY_UI_THEME + "/images/ui-icons_2e83ff_256x240",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-icons_454545_256x240",
        url: JQUERY_UI_THEME + "/images/ui-icons_454545_256x240",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-icons_888888_256x240",
        url: JQUERY_UI_THEME + "/images/ui-icons_888888_256x240",
        exts: [ ".png" ]
    },
    {
        target: "jquery-ui/images/ui-icons_cd0a0a_256x240",
        url: JQUERY_UI_THEME + "/images/ui-icons_cd0a0a_256x240",
        exts: [ ".png" ]
    },
    {
        target: "icon-font/font/jquery-ui",
        url: "https://github.com/mkkeck/jquery-ui-iconfont/blob/master/font/jquery-ui",
        url_params: "?raw=true",
        exts: [ ".woff", ".woff2", ".ttf", ".eot" ]
    },
    {
        target: "font-awesome/css/solid",
        url: CLOUDFLARE + "font-awesome/5.9.0/css/solid",
        exts: [ ".css", ".min.css" ]
    },
    {
        target: "font-awesome/webfonts/fa-solid-900",
        url: CLOUDFLARE + "font-awesome/5.9.0/webfonts/fa-solid-900",
        exts: [ ".woff", ".woff2", ".ttf", ".svg" ]
    }
];

let promises = [];

for (let file of files) {
    if (!file.url) {
        console.log("Bad url", file);
        throw "Bad";
    }
    if (!file.target) {
        console.log("Bad target", file);
        throw "Bad";
    }
    for (let ext of file.exts)
        promises.push(get(file.url + ext + (file.url_params || ""),
                          file.target + ext));
}

Promise.all(promises)
.then(() => {
    console.log("All downloaded");
});
