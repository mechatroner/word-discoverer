function request_unhighlight(lemma) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {wdm_unhighlight: lemma});
    });
}

function make_id_suffix(text) {
    var before = btoa(text);
    var after = before.replace(/\+/g, '_').replace(/\//g, '-').replace(/=/g, '_')
    return after;
}

function add_lexeme(lexeme, result_handler) {
    //we have to use a callback because local.get() is async
    chrome.storage.local.get(['words_discoverer_eng_dict', 'wd_idioms', 'wd_user_vocabulary'], function(result) {
        var dict_words = result.words_discoverer_eng_dict;
        var dict_idioms = result.wd_idioms;
        var user_vocabulary = result.wd_user_vocabulary;
        if (lexeme.length > 100) {
            result_handler("bad", undefined);
            return;
        }
        lexeme = lexeme.toLowerCase();
        lexeme = lexeme.trim();
        if (!lexeme) {
            result_handler("bad", undefined);
            return;
        }
        var key = lexeme;
        if (dict_words.hasOwnProperty(lexeme)) {
            var wf = dict_words[lexeme];
            if (wf) {
                key = wf[0];
            }
        } else if (dict_idioms.hasOwnProperty(lexeme)) {
            var wf = dict_idioms[lexeme];
            if (wf && wf != -1) {
                key = wf;
            }
        }

        if (user_vocabulary.hasOwnProperty(key)) {
            result_handler("exists", key);
            return;
        }
        user_vocabulary[key] = 1;
        chrome.storage.local.set({'wd_user_vocabulary': user_vocabulary});
        result_handler("ok", key);
    });
}


function make_hl_style(hl_params) {
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
    result += "font-size:inherit;display:inline;";
    return result;
}

function localizeHtmlPage() {
    //Localize by replacing __MSG_***__ meta tags
    var objects = document.getElementsByTagName('html');
    for (var j = 0; j < objects.length; j++) {
        var obj = objects[j];
        var valStrH = obj.innerHTML.toString();
        var valNewH = valStrH.replace(/__MSG_(\w+)__/g, function(match, v1) {
            return v1 ? chrome.i18n.getMessage(v1) : "";
        });
        if(valNewH != valStrH) {
            obj.innerHTML = valNewH;
        }
    }
}

