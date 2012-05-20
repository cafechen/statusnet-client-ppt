/**
 * StatusNet Desktop
 *
 * Copyright 2010 StatusNet, Inc.
 * Based in part on Tweetanium
 * Copyright 2008-2009 Kevin Whinnery and Appcelerator, Inc.
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

/**
 * Constructor
 */
StatusNet.Theme = function(themePath) {
    this.themeName = themePath; // @todo Have a better way of establishing a name
    this.themePath = "theme/" + themePath + "/";
    this.defaultThemePath = "theme/default/";
    this.cssPath = this.themePath + "css/";
    this.defaultCssPath = this.defaultThemePath + "css/";
    this.imagePath = this.themePath + "images/";
    this.defaultImagePath = this.defaultThemePath + "images/";
    this.soundPath = this.themePath + "sounds/";
    this.defaultSoundPath = this.defaultThemePath + "sounds/";
};

StatusNet.Theme.getTheme = function() {
    return new StatusNet.Theme(StatusNet.Config.getConfig().getThemeName());
};

StatusNet.Theme.prototype.getStylesheet = function(filename) {

    var themeCss = this.cssPath + filename;

    if (this.existsInTheme(themeCss)) {
        return themeCss;
    } else {
        return this.defaultCssPath + filename;
    }

    return cssFile;
};

StatusNet.Theme.prototype.getImage = function(filename) {

    var themeImage = this.imagePath + filename;

    if (this.existsInTheme(themeImage)) {
        return themeImage;
    } else {
        return this.defaultImagePath + filename;
    }
};

StatusNet.Theme.prototype.getSound = function(filename) {

    var themeSoundPath = this.soundPath + filename;

    if (this.existsInTheme(themeSoundPath)) {
        return themeSoundPath;
    } else {
        return this.defaultSoundPath + filename;
    }
};

StatusNet.Theme.prototype.getThemeStylesheet = function() {

    var themeCss = this.cssPath + this.themeName + ".css";

    if (this.existsInTheme(themeCss)) {
        return themeCss;
    } else {
        return false;
    }
};

StatusNet.Theme.prototype.getDisplayStylesheet = function() {
    return this.getStylesheet("display.css");
};

StatusNet.Theme.prototype.getNewNoticeStylesheet = function() {
    return this.getStylesheet("new_notice.css");
};

StatusNet.Theme.prototype.getSettingsStylesheet = function() {
    return this.getStylesheet("settings.css");
};

StatusNet.Theme.prototype.getDirectMessageStylesheet = function() {
    return this.getStylesheet("direct_message.css");
};

StatusNet.Theme.prototype.existsInTheme = function(filePath) {
    var themeFile = Titanium.Filesystem.getFile(Titanium.App.appURLToPath("app://" + filePath));
    return themeFile.exists();
};

StatusNet.Theme.prototype.getDefaultSiteLogo = function() {
    return this.getImage("logo.png");
};

StatusNet.Theme.prototype.getDefaultUserImage = function() {
    return this.getImage("default-avatar-stream.png");
};

StatusNet.Theme.prototype.getSpinner = function() {
    return this.getImage("loading.gif");
};

// @todo: make the names of these sound files more generic like post_notice.wav

StatusNet.Theme.prototype.getPostNoticeSound = function() {
    var soundPath = "app://" + this.getSound("postnotice.wav");
    return Titanium.Media.createSound(soundPath);
};

StatusNet.Theme.prototype.getNewNoticesSound = function() {
    var soundPath = "app://" + this.getSound("newnotices.wav");
    return Titanium.Media.createSound(soundPath);
};

StatusNet.Theme.listAvailable = function() {
    // stub
};
