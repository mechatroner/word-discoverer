var gapi_loaded = false;
var gapi_inited = false;

//TODO check chrome.runtime.lastError for all storage.local operations

function do_load_dictionary(file_text) {
    var lines = file_text.split('\n');
    var rare_words = {};
    var rank = 0;
    var prev_lemma = null;
    for (var i = 0; i < lines.length; ++i) {
        var fields = lines[i].split('\t');
        if (i + 1 === lines.length && fields.length == 1)
            break;
        var form = fields[0];
        var lemma = fields[1];
        if (lemma !== prev_lemma) {
            rank += 1;
            prev_lemma = lemma;
        }
        rare_words[fields[0]] = [fields[1], rank];
    }
    local_storage = chrome.storage.local;
    local_storage.set({"words_discoverer_eng_dict": rare_words});
    local_storage.set({"wd_word_max_rank": rank});
}


function load_eng_dictionary() {
    var file_path = chrome.extension.getURL("eng_dict.txt");
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            do_load_dictionary(xhr.responseText);
        }
    }
    xhr.open('GET', file_path, true);
    xhr.send(null);
}


function do_load_idioms(file_text) {
    var lines = file_text.split('\n');
    var rare_words = {};
    for (var lno = 0; lno < lines.length; ++lno) {
        var fields = lines[lno].split('\t');
        if (lno + 1 === lines.length && fields.length == 1)
            break;
        var words = fields[0].split(' ');
        for (var i = 0; i + 1 < words.length; ++i) {
            key = words.slice(0, i + 1).join(' ');
            rare_words[key] = -1;
        }
        key = fields[0];
        rare_words[key] = fields[1];
    }
    local_storage = chrome.storage.local;
    local_storage.set({"wd_idioms": rare_words});
}


function load_idioms() {
    file_path = chrome.extension.getURL("eng_idioms.txt");
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            do_load_idioms(xhr.responseText);
        }
    }
    xhr.open('GET', file_path, true);
    xhr.send(null);
}


function report_sync_failure(error_msg) {
    chrome.storage.local.set({"wd_last_sync_error": error_msg}, function () {
        chrome.runtime.sendMessage({'sync_feedback': 1});
    });
}


function load_script(url, callback_func) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState !== 4)
            return;
        if (request.status !== 200)
            return;
        eval(request.responseText);
        callback_func();
    };
    request.open('GET', url);
    request.send();
}


function authorize_user(interactive_authorization) {
    chrome.identity.getAuthToken({interactive: interactive_authorization}, function (token) {
        if (token === undefined) {
            report_sync_failure('Unable to get oauth token');
        } else {
            gapi.client.setToken({access_token: token});
            sync_user_vocabularies();
        }
    });
}


function transform_key(src_key) {
    var dc = window.atob(src_key);
    dc = dc.substring(3);
    dc = dc.substring(0, dc.length - 6);
    return dc;
}


function generate_key() {
    var protokey = 'b2ZCQUl6YVN5Q2hqM2xvZkJPWnV2TUt2TGNCSlVaa0RDTUhZa25NWktBa25NWktB';
    return transform_key(protokey);
}


function list_to_set(src_list) {
    result = {};
    for (var i = 0; i < src_list.length; ++i) {
        result[src_list[i]] = 1;
    }
    return result;
}


function substract_from_set(lhs_set, rhs_set) {
    for (var key in rhs_set) {
        if (rhs_set.hasOwnProperty(key) && lhs_set.hasOwnProperty(key)) {
            delete lhs_set[key];
        }
    }
}


function add_to_set(lhs_set, rhs_set) {
    for (var key in rhs_set) {
        if (rhs_set.hasOwnProperty(key)) {
            lhs_set[key] = 1;
        }
    }
}


function serialize_vocabulary(entries) {
    keys = [];
    for (var key in entries) {
        if (entries.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    keys.sort();
    return keys.join('\r\n');
}


function parse_vocabulary(text) {
    // code duplication with parse_vocabulary in import.js
    var lines = text.split('\n');
    var found = [];
    for (var i = 0; i < lines.length; ++i) {
        var word = lines[i];
        if (i + 1 === lines.length && word.length <= 1)
            break;
        if (word.slice(-1) === '\r') {
            word = word.slice(0, -1);
        }
        found.push(word);
    }
    return found;
}


function create_new_dir(dir_name, success_cb) {
    var body = {"name": dir_name, "mimeType": "application/vnd.google-apps.folder", "appProperties": {"wdfile": '1'}};
    var req_params = {'path': 'https://www.googleapis.com/drive/v3/files/', 'method': 'POST', 'body': body};
    gapi.client.request(req_params).then(function (jsonResp, rawResp) {
        if (jsonResp.status == 200) {
            success_cb(jsonResp.result.id);
        } else {
            report_sync_failure('Bad dir create status: ' + jsonResp.status);
        }
    });
}


function create_new_file(fname, parent_dir_id, success_cb) {
    var body = {"name": fname, "parents": [parent_dir_id], "appProperties": {"wdfile": '1'}, "mimeType": "text/plain"};
    var req_params = {'path': 'https://www.googleapis.com/drive/v3/files', 'method': 'POST', 'body': body};
    gapi.client.request(req_params).then(function (jsonResp, rawResp) {
        if (jsonResp.status == 200) {
            success_cb(jsonResp.result.id);
        } else {
            report_sync_failure('Bad file create status: ' + jsonResp.status);
        }
    });
}


function upload_file_content(file_id, file_content, success_cb) {
    var req_params = {
        'path': 'https://www.googleapis.com/upload/drive/v3/files/' + file_id,
        'method': 'PATCH',
        'body': file_content
    };
    gapi.client.request(req_params).then(function (jsonResp, rawResp) {
        if (jsonResp.status == 200) {
            success_cb();
        } else {
            report_sync_failure('Bad upload content status: ' + jsonResp.status);
        }
    });
}


function fetch_file_content(file_id, success_cb) {
    // https://developers.google.com/drive/v3/web/manage-downloads
    var full_query_url = 'https://www.googleapis.com/drive/v3/files/' + file_id + '?alt=media';
    gapi.client.request({'path': full_query_url, 'method': 'GET'}).then(function (jsonResp, rawResp) {
        if (jsonResp.status != 200) {
            report_sync_failure('Bad status: ' + jsonResp.status + ' for getting content of file: ' + file_id);
            return;
        }
        var file_content = jsonResp.body;
        success_cb(file_id, file_content);
    });
}


function find_gdrive_id(query, found_cb, not_found_cb) {
    // generic function to find single object id
    var full_query_url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query);
    gapi.client.request({'path': full_query_url, 'method': 'GET'}).then(function (jsonResp, rawResp) {
        if (jsonResp.status != 200) {
            report_sync_failure('Bad status: ' + jsonResp.status + ' for query: ' + query);
            return;
        }
        if (jsonResp.result.files.length > 1) {
            report_sync_failure('More than one object found for query: ' + query);
            return;
        } else if (jsonResp.result.files.length == 1) {
            var drive_id = jsonResp.result.files[0].id
            found_cb(drive_id);
            return;
        }
        not_found_cb();
    });
}


function apply_cloud_vocab(entries) {
    var sync_date = new Date();
    var sync_time = sync_date.getTime();
    var new_state = {
        "wd_last_sync_error": null,
        "wd_user_vocabulary": entries,
        "wd_user_vocab_added": {},
        "wd_user_vocab_deleted": {},
        "wd_last_sync": sync_time
    };
    chrome.storage.local.set(new_state, function () {
        chrome.runtime.sendMessage({'sync_feedback': 1});
    });
}


function sync_vocabulary(dir_id, vocab) {
    merge_and_upload_vocab = function (file_id, file_content) {
        vocab_list = parse_vocabulary(file_content);
        var entries = list_to_set(vocab_list);
        substract_from_set(entries, vocab.deleted);
        add_to_set(entries, vocab.added);
        merged_content = serialize_vocabulary(entries);

        set_merged_vocab = function () {
            apply_cloud_vocab(entries);
        }
        upload_file_content(file_id, merged_content, set_merged_vocab);
    }

    merge_vocab_to_cloud = function (file_id) {
        fetch_file_content(file_id, merge_and_upload_vocab);
    }

    var vocab_file_name = vocab.name + ".txt";
    var file_query = "name = '" + vocab_file_name + "' and trashed = false and appProperties has { key='wdfile' and value='1' } and '" + dir_id + "' in parents";
    create_new_file_wrap = function () {
        create_new_file(vocab_file_name, dir_id, merge_vocab_to_cloud);
        var new_added = {};
        add_to_set(new_added, vocab.all);
        add_to_set(new_added, vocab.added);
        vocab.added = new_added;
    }
    find_gdrive_id(file_query, merge_vocab_to_cloud, create_new_file_wrap);
}


function backup_vocabulary(dir_id, vocab, success_cb) {
    merge_and_upload_backup = function (file_id, file_content) {
        vocab_list = parse_vocabulary(file_content);
        var entries = list_to_set(vocab_list);
        add_to_set(entries, vocab.all);
        add_to_set(entries, vocab.deleted);
        add_to_set(entries, vocab.added);
        merged_content = serialize_vocabulary(entries);
        upload_file_content(file_id, merged_content, success_cb);
    }
    merge_backup_to_cloud = function (file_id) {
        fetch_file_content(file_id, merge_and_upload_backup);
    }

    var backup_file_name = "." + vocab.name + ".backup";
    var backup_query = "name = '" + backup_file_name + "' and trashed = false and appProperties has { key='wdfile' and value='1' } and '" + dir_id + "' in parents";
    create_new_backup_file_wrap = function () {
        create_new_file(backup_file_name, dir_id, merge_backup_to_cloud);
    }
    find_gdrive_id(backup_query, merge_backup_to_cloud, create_new_backup_file_wrap);
}


function perform_full_sync(vocab) {
    var dir_name = "Words Discoverer Sync";
    var dir_query = "name = '" + dir_name + "' and trashed = false and appProperties has { key='wdfile' and value='1' }";
    backup_and_sync_vocabulary = function (dir_id) {
        sync_vocabulary_wrap = function () {
            sync_vocabulary(dir_id, vocab);
        }
        backup_vocabulary(dir_id, vocab, sync_vocabulary_wrap);
    }
    create_new_dir_wrap = function () {
        create_new_dir(dir_name, backup_and_sync_vocabulary);
    }
    find_gdrive_id(dir_query, backup_and_sync_vocabulary, create_new_dir_wrap);
}


function sync_user_vocabularies() {
    chrome.storage.local.get(['wd_user_vocabulary', 'wd_user_vocab_added', 'wd_user_vocab_deleted'], function (result) {
        var wd_user_vocabulary = result.wd_user_vocabulary;
        var wd_user_vocab_added = result.wd_user_vocab_added;
        var wd_user_vocab_deleted = result.wd_user_vocab_deleted;
        if (typeof wd_user_vocabulary === 'undefined') {
            wd_user_vocabulary = {};
        }
        if (typeof wd_user_vocab_added === 'undefined') {
            wd_user_vocab_added = Object.assign({}, wd_user_vocabulary);
        }
        if (typeof wd_user_vocab_deleted === 'undefined') {
            wd_user_vocab_deleted = {};
        }
        var vocab = {
            "name": "my_vocabulary",
            "all": wd_user_vocabulary,
            "added": wd_user_vocab_added,
            "deleted": wd_user_vocab_deleted
        };
        perform_full_sync(vocab);
    });
}


function init_gapi(interactive_authorization) {
    gapikey = generate_key();
    init_params = {apiKey: gapikey};
    gapi.client.init(init_params).then(function () {
        gapi_inited = true;
        authorize_user(interactive_authorization);
    }, function (reject_reason) {
        var error_msg = 'Unable to init client. Reject reason: ' + reject_reason;
        console.error(error_msg);
        report_sync_failure(error_msg);
    });
}


function load_and_init_gapi(interactive_authorization) {
    load_script('https://apis.google.com/js/api.js', function () {
        gapi.load('client', function () {
            gapi_loaded = true;
            init_gapi(interactive_authorization);
        });
    });
}


function start_sync_sequence(interactive_authorization) {
    chrome.storage.local.set({"wd_last_sync_error": 'Unknown sync problem'}, function () {
        if (!gapi_loaded) {
            load_and_init_gapi(interactive_authorization);
        } else if (!gapi_inited) {
            init_gapi(interactive_authorization);
        } else {
            authorize_user(interactive_authorization);
        }
    });
}


function initialize_extension() {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.wdm_request == "hostname") {
            tab_url = sender.tab.url;
            var url = new URL(tab_url);
            var domain = url.hostname;
            sendResponse({wdm_hostname: domain});
        } else if (request.wdm_request == "page_language") {
            chrome.tabs.detectLanguage(sender.tab.id, function(iso_language_code) {
                sendResponse({wdm_iso_language_code: iso_language_code});
            });
            return true; // This is to indicate that sendResponse would be sent asynchronously and keep the message channel open, see https://developer.chrome.com/extensions/runtime#event-onMessage
        } else if (request.wdm_verdict) {
            if (request.wdm_verdict == "highlight") {
                chrome.storage.local.get(['wd_gd_sync_enabled', 'wd_last_sync_error'], function (result) {
                    chrome.browserAction.setIcon({path: "result48.png", tabId: sender.tab.id}, function () {
                        if (result.wd_gd_sync_enabled) {
                            if (result.wd_last_sync_error == null) {
                                chrome.browserAction.setBadgeText({text: 'sync', tabId: sender.tab.id});
                                chrome.browserAction.setBadgeBackgroundColor({
                                    color: [25, 137, 0, 255],
                                    tabId: sender.tab.id
                                });
                            } else {
                                chrome.browserAction.setBadgeText({text: 'err', tabId: sender.tab.id});
                                chrome.browserAction.setBadgeBackgroundColor({
                                    color: [137, 0, 0, 255],
                                    tabId: sender.tab.id
                                });
                            }
                        }
                    });
                });
            } else if (request.wdm_verdict == "keyboard") {
                chrome.browserAction.setIcon({path: "no_dynamic.png", tabId: sender.tab.id});
            } else {
                chrome.browserAction.setIcon({path: "result48_gray.png", tabId: sender.tab.id});
            }
        } else if (request.wdm_new_tab_url) {
            var fullUrl = request.wdm_new_tab_url;
            chrome.tabs.create({'url': fullUrl}, function (tab) {
            });
        } else if (request.wdm_request == "gd_sync") {
            start_sync_sequence(request.interactive_mode);
        }
    });

    chrome.storage.local.get(['words_discoverer_eng_dict', 'wd_hl_settings', 'wd_online_dicts', 'wd_hover_settings', 'wd_idioms', 'wd_show_percents', 'wd_is_enabled', 'wd_user_vocabulary', 'wd_black_list', 'wd_white_list', 'wd_gd_sync_enabled', 'wd_enable_tts'], function (result) {
        load_eng_dictionary();
        load_idioms();
        wd_hl_settings = result.wd_hl_settings;
        if (typeof wd_hl_settings == 'undefined') {
            word_hl_params = {
                enabled: true,
                quoted: false,
                bold: true,
                useBackground: false,
                backgroundColor: "rgb(255, 248, 220)",
                useColor: true,
                color: "red"
            };
            idiom_hl_params = {
                enabled: true,
                quoted: false,
                bold: true,
                useBackground: false,
                backgroundColor: "rgb(255, 248, 220)",
                useColor: true,
                color: "blue"
            };
            wd_hl_settings = {
                wordParams: word_hl_params,
                idiomParams: idiom_hl_params,
            };
            chrome.storage.local.set({"wd_hl_settings": wd_hl_settings});
        }
        wd_enable_tts = result.wd_enable_tts;
        if (typeof wd_enable_tts == 'undefined') {
            chrome.storage.local.set({"wd_enable_tts": false});
        }
        wd_hover_settings = result.wd_hover_settings;
        if (typeof wd_hover_settings == 'undefined') {
            wd_hover_settings = {hl_hover: 'always', ow_hover: 'never'};
            chrome.storage.local.set({"wd_hover_settings": wd_hover_settings});
        }
        var wd_online_dicts = result.wd_online_dicts;
        if (typeof wd_online_dicts == 'undefined') {
            wd_online_dicts = make_default_online_dicts();
            chrome.storage.local.set({"wd_online_dicts": wd_online_dicts});
        }
        initContextMenus(wd_online_dicts);

        show_percents = result.wd_show_percents;
        if (typeof show_percents === 'undefined') {
            chrome.storage.local.set({"wd_show_percents": 15});
        }
        wd_is_enabled = result.wd_is_enabled;
        if (typeof wd_is_enabled === 'undefined') {
            chrome.storage.local.set({"wd_is_enabled": true});
        }
        user_vocabulary = result.wd_user_vocabulary;
        if (typeof user_vocabulary === 'undefined') {
            chrome.storage.local.set({"wd_user_vocabulary": {}});
        }
        black_list = result.wd_black_list;
        if (typeof black_list === 'undefined') {
            chrome.storage.local.set({"wd_black_list": {}});
        }
        white_list = result.wd_white_list;
        if (typeof white_list === 'undefined') {
            chrome.storage.local.set({"wd_white_list": {}});
        }
    });


    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type = "tts_speak") {
            if (!!request.word && typeof request.word === "string") {
                chrome.tts.speak(request.word, {lang: "en", gender: "male"})
            }
        }
    });
}

initialize_extension();
