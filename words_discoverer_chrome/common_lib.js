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


function sync_if_needed() {
    var req_keys = ['wd_last_sync', 'wd_gd_sync_enabled', 'wd_last_sync_error'];
    chrome.storage.local.get(req_keys, function(result) {
        var wd_last_sync = result.wd_last_sync;
        var wd_gd_sync_enabled = result.wd_gd_sync_enabled;
        var wd_last_sync_error = result.wd_last_sync_error;
        if (!wd_gd_sync_enabled || wd_last_sync_error != null) {
            return;
        }
        var cur_date = new Date();
        var mins_passed = (cur_date.getTime() - wd_last_sync) / (60 * 1000);
        var sync_period_mins = 30;
        if (mins_passed >= sync_period_mins) {
            chrome.runtime.sendMessage({wdm_request: "gd_sync", interactive_mode: false});
        }
    });
}


function add_lexeme(lexeme, result_handler) {
    var req_keys = ['words_discoverer_eng_dict', 'wd_idioms', 'wd_user_vocabulary', 'wd_user_vocab_added', 'wd_user_vocab_deleted'];
    chrome.storage.local.get(req_keys, function(result) {
        var dict_words = result.words_discoverer_eng_dict;
        var dict_idioms = result.wd_idioms;
        var user_vocabulary = result.wd_user_vocabulary;
        var wd_user_vocab_added = result.wd_user_vocab_added;
        var wd_user_vocab_deleted = result.wd_user_vocab_deleted;
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

        var new_state = {'wd_user_vocabulary': user_vocabulary};

        user_vocabulary[key] = 1;
        if (typeof wd_user_vocab_added !== 'undefined') {
            wd_user_vocab_added[key] = 1;
            new_state['wd_user_vocab_added'] = wd_user_vocab_added;
        }
        if (typeof wd_user_vocab_deleted !== 'undefined') {
            delete wd_user_vocab_deleted[key];
            new_state['wd_user_vocab_deleted'] = wd_user_vocab_deleted;
        }

        chrome.storage.local.set(new_state, function() { 
            sync_if_needed();
            result_handler("ok", key);
        });
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


function spformat(src) {
    var args = Array.prototype.slice.call(arguments, 1);
    return src.replace(/{(\d+)}/g, function(match, number) { 
        return typeof args[number] != 'undefined' ? args[number] : match;
    });
}
