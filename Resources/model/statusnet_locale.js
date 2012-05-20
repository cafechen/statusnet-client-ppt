/**
 * StatusNet Mobile
 *
 * Copyright 2010 StatusNet, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function() {

/**
 * Fetch the current locale language selection from the system.
 *
 * @return string
 * @access private
 */
function defaultLocale() {
    if (typeof navigator == "object" && typeof navigator.language == "string") {
        // In-browser or Titanium Desktop
        return navigator.language;
    } else if (typeof Titanium.Locale == "object") {
        // Titanium Mobile 1.5 or later
        return Titanium.Locale.currentLanguage;
    } else if (typeof Titanium.Platform == "object") {
        // Titanium Mobile 1.4 or earlier
        return Titanium.Platform.locale;
    } else {
        Titanium.API.warn("Platform does not expose current locale; defaulting to English.");
        return 'en';
    }
}

/**
 * Normalize various forms of locales to xx or xx-yy
 * @param {String} lang
 * @return string
 * @access private
 */
function normalizeLocale(lang) {
    var matches = /^([a-z]+)(?:[_-]([a-z]+))?/i.exec(lang);
    if (matches) {
        var chunks = [];
        chunks.push(matches[1].toLowerCase());
        if (typeof matches[2] != 'undefined' && matches[2] != '') {
            chunks.push(matches[2].toLowerCase());
        }
        return chunks.join('-');
    } else {
        Titanium.API.error("Invalid locale setting " + lang);
        return 'en';
    }
}

defaultLanguage = normalizeLocale(defaultLocale());

var loc = StatusNet.Locale = {
    /**
     * This will be initialized to the current system locale.
	 * Don't change it. :)
     */
    defaultLanguage: defaultLanguage,

    /**
     * Currently selected language.
     * This will be initialized to the current system locale.
     */
    currentLanguage: defaultLanguage,

    /**
     * Fetch a translated string.
     * Roughly compatible with Titanium.Locale.getString() in Ti Mobile 1.5
     *
     * @param {String} key
     * @return translated string, or original key if no match.
     */
    getString: function(key) {
        if (!loc._ready) {
            loc.init();
        }
        if (typeof loc._messages[key] == "string") {
            return loc._messages[key];
        } else {
            return key;
        }
    },

    _ready: false,
    _messages: {},

    /**
     * Initialize locale data.
     * Loads up the live locale data, falling back to English if none present.
     *
     * @param {String} lang: optional override to change the current locale
     */
    init: function(lang) {
        if (lang == null) {
            lang = defaultLocale();
        }
        loc.currentLanguage = lang = normalizeLocale(lang);
        var chunks = lang.split('-');

        // Load base English first and override it later...
        var order = ['en'];

        var baseLang = chunks[0];
        if (baseLang != 'en') {
            // This'll load the base variant, eg "fr" from "fr-ca"
            order.push(baseLang);
        }
        if (chunks.length > 1) {
            // And if we have another variant load that, eg "fr-ca""
            order.push(lang);
        }

        loc._messages = {};
        var paths = loc._baseDirs();
		for (var i = 0; i < paths.length; i++) {
			for (var j = 0; j < order.length; j++) {
				try {
					StatusNet.debug('QQQ: trying to load: ' + paths[i] + ' ' + order[j]);
					loc._load(paths[i], order[j]);
				} catch (e) {
					StatusNet.debug('QQQ: error loading: ' + e);
				}
			}
		}

        loc._ready = true;
    },

    /**
     * Load up the key->string mappings from i18n/<lang>/strings.xml
     * @param {String} base
     * @param {String} lang
     */
    _load: function(base, lang) {
		var file = Titanium.Filesystem.getFile(base, 'i18n', lang, 'strings.xml');
		if (file.exists()) {
			var dom = StatusNet.Platform.parseXml(file.read().toString());

			var nodes = dom.getElementsByTagName('string');
			for (var i = 0; i < nodes.length; i++) {
				var node = nodes.item(i);
				loc._messages[node.getAttribute('name')] = node.textContent || node.text;
			}
		}
    },

	availableLanguages: function() {
		StatusNet.debug('QQQ: available IN');
		var bases = loc._baseDirs();
		StatusNet.debug('QQQ: available has ' + bases.length + ' dirs');
		var langs = [];
		for (var i = 0; i < bases.length; i++) {
			var base = bases[i];
			StatusNet.debug('QQQ: checking in ' + base);
			var file = Titanium.Filesystem.getFile(base, 'i18n');
			var dirs = file.getDirectoryListing();
			StatusNet.debug('QQQ: dirs is ' + dirs);
			if (dirs == null) {
				// doesn't exist or not a dir
				continue;
			}
			StatusNet.debug('QQQ: dirs has ' + dirs.length + ' items');
			try {
				for (var j = 0; j < dirs.length; j++) {
					var dir = dirs[j];
					var subdir = (dir.toString()).replace(/^.*?([^\\\/]+)$/, '$1');
					StatusNet.debug('QQQ: checking in ' + base + '/' + subdir);
					if (subdir == normalizeLocale(subdir) &&
						!(subdir in langs) &&
						Titanium.Filesystem.getFile(base, 'i18n', subdir, 'strings.xml').exists()) {
						StatusNet.debug('QQQ: found ' + subdir);
						langs.push(subdir);
					}
				}
			} catch (e) {
				StatusNet.debug('skipping lang availability check in ' + base + ': ' + e);
			}
			StatusNet.debug('QQQ: checking OUT ' + base);
		}
		langs.sort();
		StatusNet.debug('QQQ: available OUT');
		return langs;
	},

	/**
	 * Pull list of the dirs we'll check for i18n subdirectories,
	 * in order of reverse precedence. Later dirs will override
	 * files in earlier dirs.
	 *
	 * @return array of path strings
	 */
	_baseDirs: function() {
		var dirs = [];
		dirs.push(Titanium.Filesystem.getApplicationDirectory());
		dirs.push(Titanium.Filesystem.getResourcesDirectory());         // desktop 1.0 SDK doesn't package i18n subdir in main app directory.
		dirs.push(Titanium.Filesystem.getApplicationDataDirectory());
		return dirs;
	}
};

})();

// Note this may override the default locale string in Titanium Mobile 1.5
// That's ok since we don't like its fallback behavior. :)
L = StatusNet.Locale.getString;

if (typeof String.format == "undefined") {
    String.format = sprintf;
}