// http://statusnetdev.net/zach/api/statuses/friends_timeline.as


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
 * Atom parsing class that understands some Activity Streams data
 */
StatusNet.ASJsonParser = function() {};


StatusNet.ASJsonParser.prepBackgroundParse = function(callback)
{
    // We need to create another window to put our parsing
    // context into; this'll run on another thread, so can
    // run parsing while the UI thread is working. It'll
    // post events back to the main thread to display.

    // To reduce the chance of hitting poorly-guarded race conditions
    // adjusting the application events hash maps, we're setting up
    // global events and storing the callbacks for each parse request
    // in a map while we work.
    StatusNet.ASJsonParser.callbacks = {};
    var callbacks = StatusNet.ASJsonParser.callbacks;

    Titanium.App.addEventListener('SN.backgroundParse.entry', function(event) {
        // Triggered in main context for each entry from bg context...
        var cb = callbacks[event.key];
        //Titanium.API.info("SN.backgroundParse.entry for key " + event.key + " " + cb);
        if (cb && cb.onEntry) {
            cb.onEntry.call(event.notice, event.notice);
        }
    });
    Titanium.App.addEventListener('SN.backgroundParse.success', function(event) {
        // Triggered in main context after the processing is complete...
        var cb = callbacks[event.key];
        callbacks[event.key] = undefined;
        //Titanium.API.info("SN.backgroundParse.success for key " + event.key + " " + cb);
        if (cb && cb.onSuccess) {
            cb.onSuccess();
        }
    });
    Titanium.App.addEventListener('SN.backgroundParse.fail', function(event) {
        // Triggered in main context if XML parsing failed...
        var cb = callbacks[event.key];
        callbacks[event.key] = undefined;
        //Titanium.API.info("SN.backgroundParse.fail for key " + event.key + " " + cb);
        if (cb && cb.onFail) {
            cb.onFail(event.msg);
        }
    });

    // The application will need to wait until the BG context is set up...
    Titanium.App.addEventListener('StatusNet.background.ready', function() {
        if (callback) {
            callback();
            callback = null;
        }
    });
    var window = Titanium.UI.createWindow({
        url: 'statusnet_background_parser.js',
        zIndex: -100
    });
    window.open();
};

/**
 * Pass JSON for an individual entry or whole feed to background thread
 * for parsing; each found notice will be passed back to the onEntry callback
 * along with its JSON. The onComplete callback is then called
 * once the batch is complete.
 *
 * @param json JSON for a feed or entry
 * @param onEntry function(notice) called for each individual entry.
 * @param onSuccess function() called after completion, even if there are no notices
 * @param onFail function() called on parse error
 */
StatusNet.ASJsonParser.backgroundParse = function(json, onEntry, onSuccess, onFail) {
    if (typeof json != "string") {
        var msg = "FAIL: non-string passed to StatusNet.ASJsonParser.backgroundParse!";
        StatusNet.debug(msg);
        throw msg;
    }

    // Ok, this is... fun. :)
    // We can't send live objects like DOM nodes or callbacks across JS contexts,
    // so we have to pass the source XML string into the parser's queue and let
    // it post back to this context so we can call the callbacks.

    // When making a random key ID, make sure it's a string.
    // Just using Math.random() is unsafe, as floats may change
    // when moving across contexts!
    var key = Date.now() + ':' + Math.round(Math.random() * 1000000000);
    StatusNet.ASJsonParser.callbacks[key] = {
        onEntry: onEntry,
        onSuccess: onSuccess,
        onFail: onFail
    };
    //Titanium.API.info("Background parse registered key " + key);
    Titanium.App.fireEvent('StatusNet.background.process', {
        json: json,
        key: key
    });
};

/**
 * Pass JSON for an individual entry to be parsed immediately; each found notice
 * will be passed back to the onEntry callback along with its XML string source.
 * The onComplete callback is then called once the batch is complete.
 *
 * @param jsonstring source JSON for a feed or entry
 * @param onEntry function(notice) called for each individual entry
 * @param onSuccess function() called after completion, even if there are no notices
 * @param onFail function() called on parse error
 */
StatusNet.ASJsonParser.parse = function(jsonstring, onEntry, onSuccess, onFail) {
    
    StatusNet.debug('StatusNet.ASJsonParser.parse entered!');

    var notice = null;

    var obj = JSON.parse(jsonstring);

    if (obj.actor && obj.verb) { // this is a notice

        notice = StatusNet.ASJsonParser.noticeFromEntry(obj);
        notice.jsonString = JSON.stringify(obj.items[i]);
        StatusNet.debug('StatusNet.ASJsonParser.parse - call onNotice for singleton');
        onEntry(notice);

    } else if (obj.title) { // this is a feed
        StatusNet.debug("StatusNet.ASJsonParser.parse - parsing feed");

        if (obj.items) {
            var i;
            for (i=0; i < obj.items.length; i++) {
                obj.items[i];
                StatusNet.debug("found entry -- parsing and calling onEntry");
                notice = StatusNet.ASJsonParser.noticeFromEntry(obj.items[i]);
                notice.jsonString = JSON.stringify(obj.items[i]);
                onEntry(notice);
            }

        }

    } else {
        if (onFail) {
            var msg = "Expected feed or entry, got " + jsonstring;
            onFail(msg);
        }
        return;
    }

    if (onSuccess) {
        StatusNet.debug('StatusNet.ASJsonParser.parse - calling onSuccess()');
        onSuccess();
    }
};

/**
 * Class method for generating a notice from an Atom entry
 *
 * @param DOM entry the Atom entry representing the notice
 */
StatusNet.ASJsonParser.noticeFromEntry = function(entry) {
    StatusNet.debug('noticeFromEntry ENTER');
    var startTime = Date.now();

    var notice = {};

    // STUFF IN THE <entry>
    notice.id        = entry['statusnet:notice_info'].local_id;
    notice.source    = entry['statusnet:notice_info'].source;
    notice.favorite  = entry['statusnet:notice_info'].favorite;
    notice.repeated  = entry['statusnet:notice_info'].repeated;
    notice.repeat_of = entry['statusnet:notice_info'].repeat_of || null;
    notice.published = entry.postedTime.substring(0, 19);
    notice.updated   = entry.postedTime.substring(0, 19);
    notice.title     = entry.title;
    notice.content   = entry.body;
    /* add image show */
   	if(notice.content.indexOf("jpeg") > 0){
    	var begin = notice.content.indexOf("title=\"") + 7;
    	var end = notice.content.indexOf("jpeg\"") + 4;
    	var image = notice.content.substring(begin, end);
    	Titanium.API.debug("####ppt debug: find image:" + image);
    	notice.content = notice.content + ' <img width="100" height="75" src="' + image + '" alt="">'
    }
    notice.nickname  = entry.actor.contact.preferredUsername;
    notice.author    = entry.actor.contact.preferredUsername;
    notice.authorUri = entry.actor.url;
    notice.authorId  = entry.actor['statusnet:profile_info'].local_id;
    notice.following = entry.actor['statusnet:profile_info'].following;
    notice.blocking  = notice.blocking = entry.actor['statusnet:profile_info'].blocking;
    notice.fullname  = entry.actor.contact.displayName;
    notice.avatar    = entry.actor.image.url;
    if (entry.geopoint) {
        notice.lat       = entry.geopoint.coordinates[0];
        notice.lon       = entry.geopoint.coordinates[1];
    }
    if (notice.context && notice.context.conversation) {
        notice.contextLink = notice.context.conversation;
    }

    // notice.inReplyToLink??



    // @todo ostatus:attention ?

    // @todo category / tags / groups ?

    var ms = Date.now() - startTime;

    Titanium.API.info('noticeFromEntry CHECKPOINT EXIT: ' + ms + 'ms');
    return notice;
};

StatusNet.ASJsonParser.parseSubject = function(subject) {
    var i;

    var author = {};

    author.username = subject.contact.preferredUsername;
    author.fullname = subject.displayName;
    author.link = subject.id;
    author.id   = subject['statusnet:profile_info'].local_id;

    if (subject.geopoint) {
        author.lat       = subject.geopoint.coordinates[0];
        author.lon       = subject.geopoint.coordinates[1];
    }

    if (subject.contact.addresses) {
        author.location = subject.contact.addresses.formatted;
    }


    // @todo: this homepage parse is sketchy. If we add other URLs we will need to update
    if (subject.contact.urls) {
        for (i=0; i < subject.contact.urls.length; i++) {
            if (subject.contact.urls[i].type == "homepage") {
                author.homepage = subject.contact.urls[i].value;
            }
        }
    }

    author.bio = subject.contact.note;

    // note: attribute selectors seem to have problems with [media:width=48]

    for (i=0; i < subject.avatarLinks.length; i++) {

        switch(parseInt(subject.avatarLinks[i].width, 10)) {
            case 24:
                author.avatarSmall = subject.avatarLinks[i].url;
                break;
            case 48:
                author.avatarMedium = subject.avatarLinks[i].url;
                break;
            case 96:
                author.avatarLarge = subject.avatarLinks[i].url;
                break;
        }

    }

    return author;
};

/**
 * Class method for generating a user object from an
 * activity:subject.
 *
 * @param DOM subject the Atom feed's activity subject element
 */
StatusNet.ASJsonParser.userFromSubject = function(subject) {
    return StatusNet.ASJsonParser.parseSubject(subject);
};

/**
 * Class method for generating an group object from an
 * activity:subject.
 *
 * @param DOM subject the Atom feed's activity subject element
 */
StatusNet.ASJsonParser.groupFromSubject = function(subject) {
    return StatusNet.ASJsonParser.parseSubject(subject);
};

StatusNet.ASJsonParser.getGroup = function(data) {
    StatusNet.error('NYI!');
    return false;
    // var subject = $(data).find("feed > [nodeName=activity:subject]:first");
    // var group = StatusNet.ASJsonParser.groupFromSubject(subject);
    //
    // var group_info = $(data).find('feed > [nodeName=statusnet:group_info]:first');
    // group.member = group_info.attr('member');
    // group.memberCount = group_info.attr('member_count');
    // group.blocked = group_info.attr('blocked');
    //
    // return group;
};
