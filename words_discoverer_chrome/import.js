function parse_vocabulary(text) {
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

function add_new_words(new_words) {
    chrome.storage.local.get(['wd_user_vocabulary'], function(result) {
        var user_vocabulary = result.wd_user_vocabulary;
        var num_added = 0;
        for (var i = 0; i < new_words.length; ++i) {
            var word = new_words[i];
            if (!(user_vocabulary.hasOwnProperty(word))) {
                user_vocabulary[word] = 1;
                ++num_added;
            }
        }
        if (num_added) {
            chrome.storage.local.set({"wd_user_vocabulary": user_vocabulary});
        }
        var num_skipped = new_words.length - num_added;
        document.getElementById("addedInfo").textContent = "Added " + num_added + " new words.";
        document.getElementById("skippedInfo").textContent = "Skipped " + num_skipped + " existing words.";
    });
}

function process_change() {
    var inputElem = document.getElementById("doLoadVocab");
    var baseName = inputElem.files[0].name;
    document.getElementById("fnamePreview").textContent = baseName;
}

function process_submit() {
    var inputElem = document.getElementById("doLoadVocab");
    var file = inputElem.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
        var new_words = parse_vocabulary(reader.result);
        add_new_words(new_words);
    }
    reader.readAsText(file);
}

function init_controls() {
    window.onload=function() {
        localizeHtmlPage();
        document.getElementById("vocabSubmit").addEventListener("click", process_submit);
        document.getElementById("doLoadVocab").addEventListener("change", process_change);
    }
}

init_controls();
