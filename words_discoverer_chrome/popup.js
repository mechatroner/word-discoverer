var dict_size = null;
var enabled_mode = true;


function display_mode() {
    chrome.tabs.getSelected(null, function (tab) {
        var url = new URL(tab.url);
        var domain = url.hostname;
        document.getElementById("addHostName").textContent = domain;
        if (enabled_mode) {
            document.getElementById("rb_enabled").checked = true; 
            document.getElementById("addToListLabel").textContent = chrome.i18n.getMessage("addSkippedLabel");
            document.getElementById("addToListLabel").href = chrome.extension.getURL('black_list.html');
            chrome.storage.local.get(["wd_black_list",], function(result) {
                var black_list = result.wd_black_list;
                document.getElementById("addToList").checked = black_list.hasOwnProperty(domain);
            });
        } else {
            document.getElementById("rb_disabled").checked = true; 
            document.getElementById("addToListLabel").textContent = chrome.i18n.getMessage("addFavoritesLabel");
            document.getElementById("addToListLabel").href = chrome.extension.getURL('white_list.html');
            chrome.storage.local.get(["wd_white_list",], function(result) {
                var white_list = result.wd_white_list;
                document.getElementById("addToList").checked = white_list.hasOwnProperty(domain);
            });
        }
    });
}

function process_checkbox() {
    checkboxElem = document.getElementById("addToList");
    chrome.tabs.getSelected(null, function (tab) {
        var url = new URL(tab.url);
        var domain = url.hostname;
        document.getElementById("addHostName").textContent = domain;
        var list_name = enabled_mode ? "wd_black_list" : "wd_white_list";
        chrome.storage.local.get([list_name], function(result) {
            var site_list = result[list_name];
            if (checkboxElem.checked) {
                site_list[domain] = 1;
            } else {
                delete site_list[domain];
            }
            chrome.storage.local.set({[list_name]: site_list}, function() {
                display_mode();
            });
        });
    });
}


function process_mode_switch() {
    if (document.getElementById("rb_enabled").checked) {
        enabled_mode = true;
    } else if (document.getElementById("rb_disabled").checked) {
        enabled_mode = false;
    }
    chrome.storage.local.set({"wd_is_enabled": enabled_mode});
    display_mode();
}

function process_show() {
    chrome.tabs.create({'url': chrome.extension.getURL('display.html')}, function(tab) {
      // opens import dialong in new tab
    });
}

function process_help() {
    chrome.tabs.create({'url': chrome.extension.getURL('help.html')}, function(tab) {
      // opens import dialong in new tab
    });
}

function process_adjust() {
    chrome.tabs.create({'url': chrome.extension.getURL('adjust.html')}, function(tab) {
      // opens adjust dialong in new tab
    });
}

function display_vocabulary_size() {
    chrome.storage.local.get(['wd_user_vocabulary'], function(result) {
        var wd_user_vocabulary = result.wd_user_vocabulary;
        var vocab_size = Object.keys(wd_user_vocabulary).length;
        document.getElementById("vocabIndicator").textContent = vocab_size;
    });
}


function popup_handle_add_result(report, lemma) {
    if (report === "ok") {
        request_unhighlight(lemma);
        display_vocabulary_size();
        document.getElementById('addText').value = "";
        document.getElementById('addOpResult').textContent = chrome.i18n.getMessage("addSuccess");
    } else if (report === "exists") {
        document.getElementById('addOpResult').textContent = chrome.i18n.getMessage("addErrorDupp");
    } else {
        document.getElementById('addOpResult').textContent = chrome.i18n.getMessage("addErrorBad");
    }
}

function process_add_word() {
    lexeme = document.getElementById('addText').value;
    if (lexeme === 'dev-mode-on') {
        chrome.storage.local.set({"wd_developer_mode": true});
        document.getElementById('addText').value = "";
        return;
    }
    if (lexeme === 'dev-mode-off') {
        chrome.storage.local.set({"wd_developer_mode": false});
        document.getElementById('addText').value = "";
        return;
    }
    add_lexeme(lexeme, popup_handle_add_result);
}

function process_rate(increase) {
    chrome.storage.local.get(['wd_show_percents'], function(result) {
        var show_percents = result.wd_show_percents;
        show_percents += increase;
        show_percents = Math.min(100, Math.max(0, show_percents));
        display_percents(show_percents);
        chrome.storage.local.set({"wd_show_percents": show_percents});
    });
}

function process_rate_m1() {
    process_rate(-1);
}
function process_rate_m10() {
    process_rate(-10);
}
function process_rate_p1() {
    process_rate(1);
}
function process_rate_p10() {
    process_rate(10);
}

function display_percents(show_percents) {
    var not_showing_cnt = Math.floor((dict_size / 100.0) * show_percents);
    document.getElementById("rateIndicator1").textContent = show_percents + "%";
    document.getElementById("rateIndicator2").textContent = show_percents + "%";
    document.getElementById("countIndicator").textContent = not_showing_cnt;
}

function init_controls() {
    window.onload=function() {
        document.getElementById("addToList").addEventListener("click", process_checkbox);
        document.getElementById("adjust").addEventListener("click", process_adjust);
        document.getElementById("showVocab").addEventListener("click", process_show);
        document.getElementById("getHelp").addEventListener("click", process_help);
        document.getElementById("addWord").addEventListener("click", process_add_word);
        document.getElementById("rateM10").addEventListener("click", process_rate_m10);
        document.getElementById("rateM1").addEventListener("click", process_rate_m1);
        document.getElementById("rateP1").addEventListener("click", process_rate_p1);
        document.getElementById("rateP10").addEventListener("click", process_rate_p10);
        document.getElementById("rb_enabled").addEventListener("click", process_mode_switch);
        document.getElementById("rb_disabled").addEventListener("click", process_mode_switch);

        document.getElementById("addText").addEventListener("keyup", function(event) {
            event.preventDefault();
            if (event.keyCode == 13) {
                process_add_word();
            }
        });

        display_vocabulary_size();

        chrome.storage.local.get(['wd_show_percents', 'wd_is_enabled', 'wd_word_max_rank'], function(result) {
            var show_percents = result.wd_show_percents;
            enabled_mode = result.wd_is_enabled;
            dict_size = result.wd_word_max_rank;
            display_percents(show_percents);
            display_mode();
        });
    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    localizeHtmlPage();
    init_controls();
});
