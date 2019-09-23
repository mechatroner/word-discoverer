#!/usr/bin/env bash
rm -rf aided_reading
git clone https://github.com/mechatroner/aided_reading.git
if [ -d words_discoverer_chrome_ext ] ; then
    previous_version=$( cat words_discoverer_chrome_ext/manifest.json | grep '"version":' | cut -d '"' -f 4 )
    if [ -n "$previous_version" ] ; then
        rm -rf "words_discoverer_chrome_ext.v$previous_version"
        mv words_discoverer_chrome_ext "words_discoverer_chrome_ext.v$previous_version"
    fi
fi
cp -r aided_reading/words_discoverer_chrome words_discoverer_chrome_ext
rm words_discoverer_chrome_ext.zip
zip -q -r words_discoverer_chrome_ext.zip words_discoverer_chrome_ext
