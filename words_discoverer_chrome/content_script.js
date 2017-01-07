//TODO check document language and don't launch if non-english

var dict_words = null;
var dict_idioms = null;

var min_show_rank = null;
var user_vocabulary = null;
var is_enabled = null;
var wd_hl_settings = null;


function make_hl_style(hl_params) {
    //TODO move to common_lib.js
    if (!hl_params.enabled)
        return undefined;
    result = "";
    if (hl_params.bold)
        result += "font-weight:bold;";
    if (hl_params.useBackground)
        result += "background-color:" + hl_params.backgroundColor + ";";
    if (hl_params.useColor)
        result += "color:" + hl_params.color + ";";
    if (!result)
        return undefined;
    return result;
}

function is_rare_word(word) {
    if (word.length <= 3)
        return false;
    var wf = undefined;
    if (dict_words.hasOwnProperty(word)) {
        wf = dict_words[word];
    }
    if (!wf || wf[1] < min_show_rank)
        return false;
    return (!user_vocabulary || !(wf[0] in user_vocabulary));
}


function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}


function text_to_hl_nodes(text, dst) {
    var lc_text = text.toLowerCase();
    var ws_text = lc_text.replace(/[,;()?!:"'.]/g, " ");
    var ws_text = ws_text.replace(/[^\u00BF-\u1FFF\u2C00-\uD7FF\w0-9 ]/g, ".");

    var tokens = ws_text.split(" ");
    var found_count = 0;
    var last_hl_end_pos = 0;
    var hl_begin = 0;
    var wordsEnabled = wd_hl_settings.wordParams.enabled;
    var idiomsEnabled = wd_hl_settings.idiomParams.enabled;
    var cur_pos = 0; //beginning of word
    var mwe_prefix = "";
    for (var i = 0; i < tokens.length; i++) {
        var found_object_type = 0;
        if (!tokens[i].length) {
            mwe_prefix = "";
        } else if (wordsEnabled && is_rare_word(tokens[i])) {
            found_object_type = 1;
            mwe_prefix = "";
            hl_begin = cur_pos;
        } else if (mwe_prefix && text[cur_pos - 1] != " ") {
            mwe_prefix = "";
        } else if (idiomsEnabled && (!cur_pos || (text[cur_pos - 1] != "'" && text[cur_pos - 1] != "\""))) {
            if (!mwe_prefix) {
                hl_begin = cur_pos;
            }
            mwe_prefix += tokens[i];
            var wf = undefined;
            if (dict_idioms.hasOwnProperty(mwe_prefix)) {
                wf = dict_idioms[mwe_prefix];
            }
            if (!wf) {
                mwe_prefix = "";
                if (hl_begin != cur_pos) {
                    //rollback
                    mwe_prefix = tokens[i];
                    hl_begin = cur_pos;
                    if (dict_idioms.hasOwnProperty(mwe_prefix)) {
                        wf = dict_idioms[mwe_prefix];
                    }
                    if (!wf) {
                        mwe_prefix = "";
                    }
                }
            }
            if (wf) {
                is_prefix = (wf === -1);
                if (is_prefix) {
                    mwe_prefix += " ";
                } else if (wf in user_vocabulary) {
                    mwe_prefix = "";
                } else {
                    found_object_type = 2;
                    mwe_prefix = "";
                }
            }
        }
        if (found_object_type) {
            text_style = null;
            if (found_object_type === 1) {
                hlParams = wd_hl_settings.wordParams;
                text_style = make_hl_style(hlParams);
            } else if (found_object_type === 2) {
                hlParams = wd_hl_settings.idiomParams;
                text_style = make_hl_style(hlParams);
            }
            found_count += 1;
            if (last_hl_end_pos < hl_begin) {
                dst.push(document.createTextNode(text.slice(last_hl_end_pos, hl_begin)));
            }
            span = document.createElement("span");
            last_hl_end_pos = cur_pos + tokens[i].length;
            span.textContent = text.slice(hl_begin, last_hl_end_pos);
            span.setAttribute("style", text_style);
            span.setAttribute("class", "wdautohl");
            dst.push(span);
        }
        cur_pos += tokens[i].length + 1;
    }
    if (found_count) {
        if (last_hl_end_pos < text.length) {
            dst.push(document.createTextNode(text.slice(last_hl_end_pos, text.length)));
        }
    }
    return found_count;
}

var good_tags_list = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "B", "SMALL", "STRONG", "Q", "DIV", "SPAN"];

mygoodfilter=function(node) {
    if (good_tags_list.indexOf(node.parentNode.tagName) !== -1)
        return NodeFilter.FILTER_ACCEPT;
    return NodeFilter.FILTER_SKIP;
}


function textNodesUnder(el){
    var n, a=[], walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,mygoodfilter,false);
    while(n=walk.nextNode())  {
        a.push(n);
    }
    return a;
}

function doHighlightText(textNodes) {
    if (textNodes === null || dict_words === null || min_show_rank === null) {
        return;
    }
    var num_found = 0;
    for (var i = 0; i < textNodes.length; i++) {
        if (textNodes[i].offsetParent === null) {
            continue;
        }
        text = textNodes[i].textContent;
        if (text.length <= 10) {
            continue;
        }
        if (text.indexOf('{') !== -1 && text.indexOf('}') !== -1) {
            continue; //pathetic hack to skip json data in text (e.g. google images use it).
        }
        new_children = []
        found_count = text_to_hl_nodes(text, new_children);
        if (found_count) {
            num_found += found_count;
            parent_node = textNodes[i].parentNode;
            assert(new_children.length > 0, "children must be non empty");
            for (var j = 0; j < new_children.length; j++) {
                parent_node.insertBefore(new_children[j], textNodes[i]);
            }
            parent_node.removeChild(textNodes[i]);
        }
        if (num_found > 10000) //limiting number of words to highlight
            break;
    }
}

function onNodeInserted(event) {
    var inobj = event.target;
    if (!inobj)
        return;
    var classattr = null;
    if (typeof inobj.getAttribute !== 'function') {
        return;
    }
    try {
        classattr = inobj.getAttribute('class');
    } catch (e) {
        return;
    }
    if (classattr !== "wdautohl") {
        var textNodes = textNodesUnder(inobj);
        doHighlightText(textNodes);
    }
}

function get_verdict(is_enabled, black_list, white_list, hostname) {
    if (black_list.hasOwnProperty(hostname)) {
        return "site in \"Skip List\"";
    }
    if (white_list.hasOwnProperty(hostname)) {
        return "highlight";
    }
    return is_enabled ? "highlight" : "site is not in \"Favorites List\"";
}

function initForPage() {
    if (!document.body)
        return;

    chrome.storage.local.get(['words_discoverer_eng_dict', 'wd_idioms', 'wd_word_max_rank', 'wd_show_percents', 'wd_is_enabled', 'wd_user_vocabulary', 'wd_hl_settings', 'wd_black_list', 'wd_white_list'], function(result) {
        dict_words = result.words_discoverer_eng_dict;
        dict_idioms = result.wd_idioms;
        user_vocabulary = result.wd_user_vocabulary;
        var show_percents = result.wd_show_percents;
        var word_max_rank = result.wd_word_max_rank;
        wd_hl_settings = result.wd_hl_settings;
        min_show_rank = (show_percents * word_max_rank) / 100;
        is_enabled = result.wd_is_enabled;
        var black_list = result.wd_black_list;
        var white_list = result.wd_white_list;

        //TODO simultaneously send page language request here
        chrome.runtime.sendMessage({wdm_request: "hostname"}, function(response) {
            var hostname = response.wdm_hostname;
            var verdict = get_verdict(is_enabled, black_list, white_list, hostname);
            chrome.runtime.sendMessage({wdm_verdict: verdict});
            if (verdict == "highlight") {
                var textNodes = textNodesUnder(document.body);
                doHighlightText(textNodes);
                document.addEventListener("DOMNodeInserted", onNodeInserted, false);
            }
        });
    });
}


document.addEventListener("DOMContentLoaded", function(event) {
    initForPage();
});

