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
 * View class for managing the sidebar
 */
StatusNet.Sidebar = function(client) {

    this.client = client;
    this.config = StatusNet.Config.getConfig();

    // handlers for sidebar image buttons

    $('#public_img').bind('click', function() { client.switchTimeline('public'); });
    $('#friends_img').bind('click', function() { client.switchTimeline('friends'); });
    $('#user_img').bind('click', function() { client.switchTimeline('user'); });
    $('#mentions_img').bind('click', function() { client.switchTimeline('mentions'); });
    $('#favorites_img').bind('click', function() { client.switchTimeline('favorites'); });

    if (this.config.directMessages()) {
        StatusNet.debug("Direct messages enabled.");
        $('#inbox_img').bind('click', function() { client.switchTimeline('inbox'); });
    } else {
        StatusNet.debug("Direct messages disabled.");
        $('#nav_timeline_inbox').remove();
    }

    $('#allgroups_img').bind('click', function() { client.switchTimeline('allgroups'); });
    $('#search_img').bind('click', function() { client.switchTimeline('search'); });
    $('#settings_img').bind('click', function() { StatusNet.showSettings(); });

    this.theme = StatusNet.Theme.getTheme();
    this.siteLogo = this.getSiteLogo();

    // set site logo the first time the sidebar is displayed
    $('#public_img').attr("src", this.siteLogo);

    // set user timeline img
    $('#user_img').attr("src", this.userImage);

    this.images = this.getNavBarImages();

    this.setSelectedTimeline(this.client.getActiveTimeline());

};

StatusNet.Sidebar.prototype.getSiteLogo = function() {

    var account = this.client.getActiveAccount();
    var siteLogo = account.siteLogo;

    // fall back to the default
    if (!siteLogo) {
        siteLogo = this.theme.getDefaultSiteLogo();
    }

    return siteLogo;
};

StatusNet.Sidebar.prototype.getSiteLogos = function() {

    var siteLogos = {};

    siteLogos.id = "#public_img";
    siteLogos.timeline = "public";

    // check for override in config first
    var selected = this.config.getSiteLogoSelected();
    if (selected) {
        selected = this.theme.getImage(selected);
    }

    var deselected = this.config.getSiteLogoDeselected();
    if (deselected) {
        deselected = this.theme.getImage(deselected);
    }

    // try for the site provided icon
    if (!selected) {
        selected = this.siteLogo;
    }

    // if we have no deselected image, then use opacity as the selected selected indicator
    if (!deselected) {
        deselected = selected;
        siteLogos.selected_class = 'opaque';
    }

    siteLogos.selected = selected;
    siteLogos.deselected = deselected;

    return siteLogos;
};

StatusNet.Sidebar.prototype.getProfileImages = function() {

    var profileImages = {};

    profileImages.id = "#user_img";
    profileImages.timeline = "user";

    // check for override in config first
    var selected = this.config.getProfileImageSelected();
    if (selected) {
        selected = this.theme.getImage(selected);
    }

    var deselected = this.config.getProfileImageDeselected();
    if (deselected) {
        deselected = this.theme.getImage(deselected);
    }

    // try for the user's profile avatar
    if (!selected) {
        var account = this.client.getActiveAccount();
        selected = this.client.account.apiGetAvatarURL();
    }

    // fall back to the default theme user avatar
    if (!selected) {
        selected = this.theme.getDefaultUserImage();
    }

    // if we have no deselected image, then use opacity as the selected selected indicator
    if (!deselected) {
        deselected = selected;
        profileImages.selected_class = 'opaque';
    }

    profileImages.selected = selected;
    profileImages.deselected = deselected;

    return profileImages;
};



StatusNet.Sidebar.prototype.getNavBarImages = function() {

    // @todo better generic names for these images and a way to
    // override via config file
    var theme = this.theme;

    var images = [
        {
            "id": "#friends_img",
            "timeline": "friends",
            "deselected": theme.getImage("sidebar/deselected/friends.png"),
            "selected": theme.getImage("sidebar/selected/friends.png")
        },
        {
            "id": "#mentions_img",
            "timeline": 'mentions',
            "deselected": theme.getImage("sidebar/deselected/mentions.png"),
            "selected": theme.getImage("sidebar/selected/mentions.png")
        },
        {
            "id": "#favorites_img",
            "timeline": "favorites",
            "deselected": theme.getImage("sidebar/deselected/favorites.png"),
            "selected": theme.getImage("sidebar/selected/favorites.png")
        },
        {
            "id": "#allgroups_img",
            "timeline": "allgroups",
            "deselected": theme.getImage("sidebar/deselected/allgroups.png"),
            "selected": theme.getImage("sidebar/selected/allgroups.png")
        },
        {
            "id": "#search_img",
            "timeline": "search",
            "deselected": theme.getImage("sidebar/deselected/search.png"),
            "selected": theme.getImage("sidebar/selected/search.png")
        },
        {
            "id": "#settings_img",
            "timeline": "settings",
            "deselected": theme.getImage("sidebar/deselected/settings.png"),
            "selected": theme.getImage("sidebar/deselected/settings.png")
        }
    ];

    if (this.config.directMessages()) {
        dmImage = {
            "id": "#inbox_img",
            "timeline": "inbox",
            "deselected": theme.getImage("sidebar/deselected/inbox.png"),
            "selected": theme.getImage("sidebar/selected/inbox.png")
        };
        images.push(dmImage);
    }

    images.push(this.getProfileImages());
    images.push(this.getSiteLogos());

    return images;
};

/**
 * Class method to higlight the icon associated with the selected timeline
 *
 * @param String timeline   the timeline to highlight
 */
StatusNet.Sidebar.prototype.setSelectedTimeline = function(timeline) {
    for (var i = 0; i < this.images.length; i++) {
        var image = this.images[i]
        if (image["timeline"] === timeline) {
            $(image["id"]).attr("src", image["selected"]);
            if (image["selected_class"]) {
                $(image["id"]).addClass(image["selected_class"]);
            }
            if (image["deselected_class"]) {
                $(image["id"]).removeClass(image["deselected_class"]);
            }
        } else {
            $(image["id"]).attr("src", image["deselected"]);
            if (image["selected_class"]) {
                $(image["id"]).removeClass(image["selected_class"]);
            }
            if (image["deselected_class"]) {
                $(image["id"]).addClass(image["deselected_class"]);
            }
        }
    }
};
