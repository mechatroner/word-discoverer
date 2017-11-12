var gapi_loaded = false;
var gapi_inited = false;

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
    xhr.onreadystatechange = function() {
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
    //FIXME code duplication
    file_path = chrome.extension.getURL("eng_idioms.txt");
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            do_load_idioms(xhr.responseText);
        }
    }
    xhr.open('GET', file_path, true);
    xhr.send(null);
}


function dbg_list_files() {
    // this function is for debug purposes only
    console.log("dbg listing files"); //FOR_DEBUG
    gapi.client.drive.files.list({
      'pageSize': 10,
      'fields': "nextPageToken, files(id, name)"
    }).then(function(response) {
        console.log('Files:');
        msg_text = 'Files:'
        console.log("response:" + response); //FOR_DEBUG
        console.log("response.result:" + response.result); //FOR_DEBUG
        var files = response.result.files;
        if (files && files.length > 0) {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                console.log(file.name + ' (' + file.id + ')');
                msg_text += file.name + ' (' + file.id + ')\n';
            }
        } else {
            msg_text += 'No files found.';
            console.log('No files found.');
        }
        chrome.runtime.sendMessage({sync_status: {message: msg_text}});
    });
}


function load_script(url, callback_func) {
  var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
        if(request.readyState !== 4)
            return;
        if(request.status !== 200)
            return;
        eval(request.responseText);
        callback_func();
    };
    request.open('GET', url);
    request.send();
}


function authorize_user(interactive_authorization) {
    console.log("authorize_user started"); //FOR_DEBUG
    // FIXME so apparently the problem is here. We fail to get the token for some reason (although the sign in menu is shown)
    //chrome.identity.getAuthToken({interactive: interactive_authorization}, function(token) {
    // FIXME use interactive_authorization parameter insted of "true"
    chrome.identity.getAuthToken({interactive: true}, function(token) {
        //FIXME check for token, if it is undefined then report an error
        console.log("Got a token!"); //FOR_DEBUG
        console.log("token:" + token); //FOR_DEBUG
        // FIXME apparently token is a string so you can store it in local storage!
        if (token === undefined) {
            chrome.runtime.sendMessage({'sync_status': {'message': 'Failed to get oauth token'}});
        } else {
            gapi.client.setToken({access_token: token});
            console.log("Token was set!"); //FOR_DEBUG
            chrome.runtime.sendMessage({'sync_status': {'message': 'Oauth token initialized'}});
            dbg_list_files();
        }
    });
}


function init_gapi(interactive_authorization) {
    console.log("init_gapi started"); //FOR_DEBUG
    api_urls = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
    // FIXME handle gapi.client.init errors
    // FIXME put the key in a special file
    init_params = {apiKey: '', discoveryDocs: api_urls};
    gapi.client.init(init_params).then(function() {
        gapi_inited = true;
        console.log('gapi inited!');
        authorize_user(interactive_authorization);
    }, function(reject_reason) { 
        var error_msg = 'Client init request was rejected. reason: ' + reject_reason;
        console.error(error_msg);
        chrome.runtime.sendMessage({'sync_status': {'message': error_msg}});
    });
}


function load_and_init_gapi(interactive_authorization) {
    console.log("load_and_init_gapi"); //FOR_DEBUG
    load_script('https://apis.google.com/js/api.js', function() {
        gapi.load('client', function() { 
            gapi_loaded = true;
            init_gapi(interactive_authorization);
        });
    });
}

function ensure_authorization(interactive_authorization) {
    console.log("gapi_loaded:" + gapi_loaded + ", gapi_inited:" + gapi_inited); //FOR_DEBUG
    if (!gapi_loaded) {
        load_and_init_gapi(interactive_authorization);
    } else if (!gapi_inited) {
        init_gapi(interactive_authorization);
    } else {
        authorize_user(interactive_authorization);
    }
}

function initialize_extension() {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.wdm_request == "hostname") {
            tab_url = sender.tab.url;
            var url = new URL(tab_url);
            var domain = url.hostname;
            sendResponse({wdm_hostname: domain});
        } else if (request.wdm_verdict) {
            if (request.wdm_verdict == "highlight") {
                chrome.browserAction.setIcon({path: "result48.png", tabId: sender.tab.id});
            } else if (request.wdm_verdict == "keyboard") {
                chrome.browserAction.setIcon({path: "no_dynamic.png", tabId: sender.tab.id});
            } else {
                chrome.browserAction.setIcon({path: "result48_gray.png", tabId: sender.tab.id});
            }
        } else if (request.wdm_new_tab_url) {
            var fullUrl = request.wdm_new_tab_url;
            chrome.tabs.create({'url': fullUrl}, function(tab) { });
        } else if (request.wdm_request == "gd_sync") {
            //FIXME you also need to setup auth token in non-interactive mode, and if it is failed change the extension icon
            ensure_authorization(true);
        }
    });

    chrome.storage.local.get(['words_discoverer_eng_dict', 'wd_hl_settings', 'wd_online_dicts', 'wd_hover_settings', 'wd_idioms', 'wd_show_percents', 'wd_is_enabled', 'wd_user_vocabulary', 'wd_black_list', 'wd_white_list'], function(result) {
        load_eng_dictionary();
        load_idioms();
        wd_hl_settings = result.wd_hl_settings;
        if (typeof wd_hl_settings == 'undefined') {
            word_hl_params = {enabled: true, quoted: false, bold: true, useBackground: false, backgroundColor: "rgb(255, 248, 220)", useColor: true, color: "red"};
            idiom_hl_params = {enabled: true, quoted: false, bold: true, useBackground: false, backgroundColor: "rgb(255, 248, 220)", useColor: true, color: "blue"};
            wd_hl_settings = {wordParams: word_hl_params, idiomParams: idiom_hl_params};
            chrome.storage.local.set({"wd_hl_settings": wd_hl_settings});
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

        // FIXME if sync is enabled - initialize the gapi

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
}

initialize_extension();
