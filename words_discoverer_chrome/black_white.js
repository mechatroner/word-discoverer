var section_name = undefined;
var list_name = undefined;

function process_delete(text) {
    chrome.storage.local.get([list_name], function(result) {
        var user_vocabulary = result[list_name];
        delete user_vocabulary[text];
        chrome.storage.local.set({[list_name]: user_vocabulary});
        show_vocabulary(user_vocabulary);
    });
}

function create_button(text) {
    var result = document.createElement("button");
    result.setAttribute("class", "deleteButton");
    result.expression_text = text;
    result.addEventListener("click", function(){ process_delete(this.expression_text); });
    var img = document.createElement("img");
    img.setAttribute("src", "delete.png");
    result.appendChild(img);
    return result;
}

function create_label(text) {
    var result = document.createElement("span");
    result.setAttribute("class", "wordText");
    result.textContent = text;
    return result;
}


function show_vocabulary(user_vocabulary) {
    var keys = []
    for (var key in user_vocabulary) {
        if (user_vocabulary.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    var div_element = document.getElementById(section_name);
    while (div_element.firstChild) {
        div_element.removeChild(div_element.firstChild);
    }
    if (!keys.length) {
        div_element.appendChild(create_label(chrome.i18n.getMessage("emptyListError")));
        div_element.appendChild(document.createElement("br"));
        return;
    }
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf("'") !== -1 || key.indexOf("\"") !== -1) {
            continue;
        }
        div_element.appendChild(create_button(key));
        div_element.appendChild(create_label(key));
        div_element.appendChild(document.createElement("br"));
    }
}


function process_display() {
    if (document.getElementById("blackListSection")) {
        section_name = "blackListSection";
        list_name = "wd_black_list";
    } else if (document.getElementById("whiteListSection")) {
        section_name = "whiteListSection";
        list_name = "wd_white_list";
    } else {
        section_name = "vocabularySection";
        list_name = "wd_user_vocabulary";
    }

    chrome.storage.local.get([list_name], function(result) {
        var user_vocabulary = result[list_name];
        show_vocabulary(user_vocabulary);
    });
}

document.addEventListener("DOMContentLoaded", function(event) {
    process_display();
});
