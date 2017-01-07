var wd_hl_settings = null;

var wc_rb_ids = ['wc1', 'wc2', 'wc3', 'wc4', 'wc5'];
var ic_rb_ids = ['ic1', 'ic2', 'ic3', 'ic4', 'ic5'];
var wb_rb_ids = ['wb1', 'wb2', 'wb3', 'wb4', 'wb5'];
var ib_rb_ids = ['ib1', 'ib2', 'ib3', 'ib4', 'ib5'];

function localizeHtmlPage() {
    //TODO move to common_lib.js
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

function highlight_example_text(hl_params, text_id, lq_id, rq_id) {
    document.getElementById(lq_id).textContent = "";
    document.getElementById(rq_id).textContent = "";
    document.getElementById(lq_id).style = undefined;
    document.getElementById(rq_id).style = undefined;
    document.getElementById(text_id).style = make_hl_style(hl_params);
}

function show_rb_states(ids, color) {
    for (var i = 0; i < ids.length; i++) {
        doc_element = document.getElementById(ids[i]);
        if (doc_element.label.style.backgroundColor == color) {
            doc_element.checked = true;
        }
    }
}

function show_internal_state() {
    var word_hl_params = wd_hl_settings.wordParams;
    var idiom_hl_params = wd_hl_settings.idiomParams;
    document.getElementById("wordsEnabled").checked = word_hl_params.enabled;
    document.getElementById("idiomsEnabled").checked = idiom_hl_params.enabled;
    document.getElementById("wordsBlock").style.display = word_hl_params.enabled ? "block" : "none";
    document.getElementById("idiomsBlock").style.display = idiom_hl_params.enabled ? "block" : "none";

    document.getElementById("wordsBold").checked = word_hl_params.bold;
    document.getElementById("idiomsBold").checked = idiom_hl_params.bold;

    document.getElementById("wordsBackground").checked = word_hl_params.useBackground;
    document.getElementById("idiomsBackground").checked = idiom_hl_params.useBackground;

    document.getElementById("wordsColor").checked = word_hl_params.useColor;
    document.getElementById("idiomsColor").checked = idiom_hl_params.useColor;


    document.getElementById("wcRadioBlock").style.display = word_hl_params.useColor ? "block" : "none";
    show_rb_states(wc_rb_ids, word_hl_params.color);
    document.getElementById("icRadioBlock").style.display = idiom_hl_params.useColor ? "block" : "none";
    show_rb_states(ic_rb_ids, idiom_hl_params.color);
    document.getElementById("wbRadioBlock").style.display = word_hl_params.useBackground ? "block" : "none";
    show_rb_states(wb_rb_ids, word_hl_params.backgroundColor);
    document.getElementById("ibRadioBlock").style.display = idiom_hl_params.useBackground ? "block" : "none";
    show_rb_states(ib_rb_ids, idiom_hl_params.backgroundColor);

    highlight_example_text(word_hl_params, "wordHlText", "wql", "wqr");
    highlight_example_text(idiom_hl_params, "idiomHlText", "iql", "iqr");
}


function add_cb_event_listener(id, dst_params, dst_key) {
    document.getElementById(id).addEventListener("click", function() {
        checkboxElem = document.getElementById(id);
        if (checkboxElem.checked) {
            dst_params[dst_key] = true;
        } else {
            dst_params[dst_key] = false;
        }
        show_internal_state();
    });
}


function process_rb(dst_params, dst_key, ids) {
    for (var i = 0; i < ids.length; i++) {
        doc_element = document.getElementById(ids[i]);
        if (doc_element.checked) {
            dst_params[dst_key] = doc_element.label.style.backgroundColor;
        }
    }
    show_internal_state();
}

function handle_rb_loop(ids, dst_params, dst_key) {
    for (var i = 0; i < ids.length; i++) {
        document.getElementById(ids[i]).addEventListener("click", function() {
            process_rb(dst_params, dst_key, ids);
        });
    }
}

function assign_back_labels() {
    var labels = document.getElementsByTagName('LABEL');
    for (var i = 0; i < labels.length; i++) {
        if (labels[i].htmlFor != '') {
             var elem = document.getElementById(labels[i].htmlFor);
             if (elem)
                elem.label = labels[i];         
        }
    }
}

function process_display() {
    window.onload=function() {
        chrome.storage.local.get(['wd_hl_settings'], function(result) {
            assign_back_labels();
            wd_hl_settings = result.wd_hl_settings;
            handle_rb_loop(wc_rb_ids, wd_hl_settings.wordParams, "color")
            handle_rb_loop(ic_rb_ids, wd_hl_settings.idiomParams, "color")
            handle_rb_loop(wb_rb_ids, wd_hl_settings.wordParams, "backgroundColor")
            handle_rb_loop(ib_rb_ids, wd_hl_settings.idiomParams, "backgroundColor")

            add_cb_event_listener("wordsEnabled", wd_hl_settings.wordParams, "enabled")
            add_cb_event_listener("idiomsEnabled", wd_hl_settings.idiomParams, "enabled")
            add_cb_event_listener("wordsBold", wd_hl_settings.wordParams, "bold")
            add_cb_event_listener("idiomsBold", wd_hl_settings.idiomParams, "bold")
            add_cb_event_listener("wordsBackground", wd_hl_settings.wordParams, "useBackground")
            add_cb_event_listener("idiomsBackground", wd_hl_settings.idiomParams, "useBackground")
            add_cb_event_listener("wordsColor", wd_hl_settings.wordParams, "useColor")
            add_cb_event_listener("idiomsColor", wd_hl_settings.idiomParams, "useColor")

            document.getElementById("saveVisuals").addEventListener("click", function() {
                chrome.storage.local.set({'wd_hl_settings': wd_hl_settings});
            });

            show_internal_state();
        });

    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    localizeHtmlPage();
    process_display();
});
