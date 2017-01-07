function do_nothing(val) {
    return;
}

function add_lexeme(lexeme, result_handler = do_nothing) {
    chrome.storage.local.get(['words_discoverer_eng_dict', 'wd_user_vocabulary'], function(result) {
        var dict_words = result.words_discoverer_eng_dict;
        var user_vocabulary = result.wd_user_vocabulary;
        if (lexeme.length > 100) {
            result_handler(-1);
            return;
        }
        lexeme = lexeme.toLowerCase();
        lexeme = lexeme.trim();
        if (!lexeme) {
            result_handler(-1);
            return;
        }
        var wf = dict_words[lexeme];
        var key = wf ? wf[0] : lexeme;
        res = (key in user_vocabulary) ? 0 : 1;
        user_vocabulary[key] = 1;
        chrome.storage.local.set({'wd_user_vocabulary': user_vocabulary});
        result_handler(res);
    });
}
