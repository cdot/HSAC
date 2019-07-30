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
        target: "require",
        url: CLOUDFLARE + "require.js/2.3.6/require",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery",
        url: JQUERY + "jquery-3.4.1",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery-ui",
        url: JQUERY + "ui/1.12.1/jquery-ui",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "js.cookie",
        url: CLOUDFLARE + "js-cookie/2.2.0/js.cookie",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery.validate",
        url: CLOUDFLARE + "jquery-validate/1.19.1/jquery.validate",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "additional-methods",
        url: CLOUDFLARE + "jquery-validate/1.19.1/additional-methods",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery.csv",
        url: CLOUDFLARE + "jquery-csv/1.0.5/jquery.csv",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery-confirm",
        url: CLOUDFLARE + "jquery-confirm/3.3.4/jquery-confirm",
        exts: [ ".min.js" ]
    },
    {
        target: "jquery.tablesorter.combined",
        url: CLOUDFLARE + "jquery.tablesorter/2.31.1/js/jquery.tablesorter.combined",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "text",
        url: CLOUDFLARE + "require-text/2.0.12/text",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery.ui.touch-punch",
        url: JSDELIVR + "jquery-ui-touch-punch@0.2.3/jquery.ui.touch-punch",
        exts: [ ".js", ".min.js" ]
    },
    {
        target: "jquery-ui/jquery-ui",
        url: JQUERY_UI_THEME + "/jquery-ui",
        exts: [ ".css", ".min.css" ]
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
        target: "icon-font/icon-font",
        url: "https://raw.githubusercontent.com/mkkeck/jquery-ui-iconfont/master/jquery-ui-1.12.icon-font",
        exts: [ ".css", ".min.css" ]
    },
    {
        target: "icon-font/font/jquery-ui",
        url: "https://github.com/mkkeck/jquery-ui-iconfont/blob/master/font/jquery-ui",
        url_params: "?raw=true",
        exts: [ ".woff", ".woff2", ".ttf", ".eot" ]
    },
    {
        target: "theme.jui",
        url: CLOUDFLARE + "jquery.tablesorter/2.31.1/css/theme.jui",
        exts: [ ".min.css" ]
    },
    {
        target: "jquery-confirm",
        url: CLOUDFLARE + "jquery-confirm/3.3.4/jquery-confirm",
        exts: [ ".min.css" ]
    },
    {
        target: "font-awesome/css/solid",
        url: CLOUDFLARE + "font-awesome/5.9.0/css/solid",
        exts: [ ".css", ".min.css" ]
    },
    {
        target: "font-awesome/css/fontawesome",
        url: CLOUDFLARE + "font-awesome/5.9.0/css/fontawesome",
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
