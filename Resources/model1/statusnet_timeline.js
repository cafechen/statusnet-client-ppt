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

var STATUSNET_FORMAT_ATOM   = 'atom';
var STATUSNET_FORMAT_ASJSON = 'as_json';


/**
 * Constructor for base timeline model class
 *
 * @param StatusNet.Client       client the controller
 * @param StatusNet.TimelineView view   the view
 */
StatusNet.Timeline = function(client) {

    this.client = client;
    this.view = client.getActiveView();
    this.account = this.client.account;
    this.db = StatusNet.getDB();

    this._notices = [];

    this.noticeAdded = new StatusNet.Event(this);
    this.updateStart = new StatusNet.Event(this);
    this.updateFinished = new StatusNet.Event(this);
};

/**
 * Add a notice (asjson entry) to the cache
 *
 * @param string timeline_name  name of the timeline
 * @param int    noticeId       ID of the notice
 * @param Object notice_obj      the entry object itself
 */
StatusNet.Timeline.prototype.encacheNotice = function(noticeId, notice_obj) {

    var json = '';

    StatusNet.debug("Timeline.encacheNotice() - encaching notice:" + noticeId + ", timeline= " + this.timeline_name + ", account=" + this.client.account.id);

    if (notice_obj && typeof notice_obj == 'object') {
        json = JSON.stringify(notice_obj);
    }

    try {
        StatusNet.debug("Inserting", noticeId,
            json,
            this.client.account.id,
            this.timeline_name,
            Date.now()
        );
        var rs = this.db.execute(
            "INSERT OR REPLACE INTO entry_asjson (notice_id, json_entry, account_id, timeline, timestamp) VALUES (?, ?, ?, ?, ?)",
            noticeId,
            json,
            this.client.account.id,
            this.timeline_name,
            Date.now()
        );

        if (rs) {
            rs.close();
        }

    } catch (e) {
        StatusNet.debug("encacheNotice - Oh no, I couldn't cache the entry: " + e);
    }
};

/**
 * Remove a notice (Atom entry) from the cache (all timelines)
 *
 * @param int noticeId  the ID of the notice to decache
 */
StatusNet.Timeline.prototype.decacheNotice = function(noticeId) {

    StatusNet.debug("Timeline.decacheNotice() - decaching notice:" + noticeId + ", timeline= " + this.timeline_name + ", account=" + this.client.account.id);

    try {

        var rs = this.db.execute(
            "DELETE FROM entry_asjson WHERE account_id = ? AND notice_id = ?",
            this.client.account.id,
            noticeId
        );

        // db doesn't always seem to return a ResultSet obj
        if (rs) {
            rs.close();
        }

    } catch (e) {
        StatusNet.debug("decacheNotice - Oh no, I couldn't decache the entry: " + e);
    }

    // @todo Check for an error condition -- how?
};

/**
 * Refresh the cache for a single notice
 *
 * @param int noticeId  the Id of the notice to refresh
 */
StatusNet.Timeline.prototype.refreshNotice = function(noticeId) {

    StatusNet.debug('Timeline.refreshNotice() - refreshing notice ' + noticeId);

    // XXX: For now, always take this from the public timeline
    var noticeUrl = 'statuses/friends_timeline.as' + '?max_id=' + noticeId + '&count=1';

    var that = this;

    this.account.apiGet(noticeUrl,
        function(status, data, responseText) {
            StatusNet.debug('Fetched ' + that.noticeUrl);

            var feed = JSON.parse(responseText);
            if (feed.items && feed.items[0]) {
                var entry = feed.items[0];
                var notice = StatusNet.ASJsonParser.noticeFromEntry(entry);
            }

            if (entry && that.cacheable()) {
                that.encacheNotice(noticeId, notice);
                StatusNet.debug('Timeline.refreshNotice(): found an entry.');
            }

        },
        function(client, msg) {
            StatusNet.debug("Something went wrong refreshing notice " + noticeId + ": " + msg);
            StatusNet.Infobar.flashMessage("Could not refresh notice " + noticeId +": " + msg);
        }
    );
};

/**
 * Add a notice to the Timeline if it's not already in it. Also
 * adds it to the notice cache, and notifies the view to display it.
 *
 * @param object  notice              the parsed form of the notice as a dict
 * @param object options dict of args: cache = true/false (defaults true)
 *
 */
StatusNet.Timeline.prototype.addNotice = function(notice, options) {
    //StatusNet.debug('Timeline.addNotice enter:');

    StatusNet.time.start('addNotice-perf');
    if (notice === null || typeof notice !== "object") {
        throw "Invalid notice passed to addNotice.";
    }
    if (!options) {
        options = {};
    }
    if (options.cache === undefined) {
        options.cache = true;
    }

    // Dedupe here?
    for (i = 0; i < this._notices.length; i++) {
        if (this._notices[i].id === notice.id) {
            StatusNet.debug("skipping duplicate notice: " + notice.id);
            return;
        }
    }

    if (notice.id !== undefined) {
        if (options.cache && this.cacheable()) {
            this.encacheNotice(notice.id, notice);
        }
    }

    //StatusNet.debug("addNotice - finished encaching notice");

    this._notices.push(notice);
    StatusNet.debug('noticeAdded on ', this.timeline_name);
    StatusNet.debug('OPTIONS FOR NOTIFY');
    StatusNet.debug(options);
    this.noticeAdded.notify({notice: notice, notify: options.notify});

    StatusNet.debug('Timeline.addNotice DONE.');
    StatusNet.time.stop('addNotice-perf');
};


/**
 * look at the extension on the method url to guess the format
 */
StatusNet.Timeline.prototype.getFeedFormatFromURL = function(url) {
    var parts = url.split('.');
    var ext = parts.pop();

    ext = ext.split('?')[0];
    StatusNet.debug('ext:'+ext);

    var format;

    switch(ext) {
        case 'as':
            format = STATUSNET_FORMAT_ASJSON;
            break;
        case 'atom':
            format = STATUSNET_FORMAT_ATOM;
            break;
        default:
            format = STATUSNET_FORMAT_ATOM;
            break;

    }

    return format;
};


/**
 * Update the timeline.  Does a fetch of the Atom feed for the appropriate
 * timeline and notifies the view the model has changed.
 */
StatusNet.Timeline.prototype.update = function(onFinish, customUrl) {
    StatusNet.debug('Timeline.update ENTERED');

    StatusNet.debug('updateStart on ' + this.timeline_name);
    this.updateStart.notify();

    StatusNet.debug('Timeline.update called updateStart.notify');

    var url = (customUrl) ? customUrl : this.getUrl();
    //var url = "http://www.baidu.com/";

    var feed_format = this.getFeedFormatFromURL(url);

    var that = this;



    this.account.apiGet(url,

        function(status, data, responseText) {
            StatusNet.debug('Timeline.update GOT DATA:');

            var entries = [];
            var entryCount = 0;

            var onEntry = function(notice) {
                // notice
                //StatusNet.debug('Got notice: ' + notice);
                //StatusNet.debug('Got notice.id: ' + notice.id);
                if (customUrl) {
                    that.addNotice(notice, {notify: false});
                } else {
                    if (that.autoRefresh()) {
                        that.addNotice(notice, {notify: true});
                    } else {
                        that.addNotice(notice, {notify: false});
                    }
                }
                entryCount++;
            };
            var onSuccess = function() {
                // success!
                StatusNet.debug('Timeline.update success!');
                StatusNet.debug('updateFinished on ', that.timeline_name);
                that.updateFinished.notify({notice_count: entryCount});


                if (onFinish) {
                    onFinish(entryCount);
                }
                // StatusNet.debug('Timeline.update calling finishedFetch...');
                that.finishedFetch(entryCount);
                StatusNet.debug('Timeline.update DONE.');
                StatusNet.time.report();
            };
            var onFailure = function(msg) {
                // if parse failure
                StatusNet.debug("Something went wrong retrieving timeline: " + msg);
                StatusNet.Infobar.flashMessage("Couldn't get timeline: " + msg);
                StatusNet.debug('updateFinished on ', that.timeline_name);
                that.updateFinished.notify({notice_count: entryCount});
            };

            // @todo Background processing for Desktop
            if (StatusNet.Platform.isMobile() && feed_format !== STATUSNET_FORMAT_ASJSON) {
                StatusNet.debug('AtomParser.backgroundParse...');
                StatusNet.AtomParser.backgroundParse(responseText, onEntry, onSuccess, onFailure);
            } else {
                if (feed_format == STATUSNET_FORMAT_ASJSON) {
                    StatusNet.debug('ASJsonParser.parse...');
                    StatusNet.ASJsonParser.parse(responseText, onEntry, onSuccess, onFailure);
                } else {
                    StatusNet.debug('AtomParser.parse...');
                    StatusNet.AtomParser.parse(responseText, onEntry, onSuccess, onFailure);
                }

            }
        },

        // @TODO should this expect JSON?
        function(status, xml, msg) {
            StatusNet.showNetworkError(status, xml, msg, "Couldn't update timeline: ");
            StatusNet.debug('updateFinished on ' + that.timeline_name);
            that.updateFinished.notify({error: msg});
        }
    );
    StatusNet.debug('Timeline.update EXITED: waiting for data return.');

};

/**
 * Get the URL for the Atom feed of this timeline
 */
StatusNet.Timeline.prototype.getUrl = function() {

    // @fixme use the current account instead of the default
    var ac = StatusNet.Account.getDefault(this.db);

    var sql = 'SELECT MAX (notice_id) AS last_id FROM entry_asjson WHERE account_id = ? AND timeline = ?';

    var lastId = 0;

    try {

        var rs = this.db.execute(sql, ac.id, this.timeline_name);

        StatusNet.debug("account = " + ac.id + ", timeline_name = " + this.timeline_name);

        if (rs.isValidRow()) {
          lastId = rs.fieldByName('last_id');
        }

        if (rs) {
            rs.close();
        }
    } catch (e) {
        StatusNet.debug("getUrl - trouble getting url for timeline: " + e);
    }

    StatusNet.debug("lastId = " + lastId);

    if (lastId > 0) {
        return this._url + '?since_id=' + lastId;
    } else {
        return this._url;
    }
};

/*
 * Get an API url appropriate for fetching older notices
 */
StatusNet.Timeline.prototype.getOlderNoticesUrl = function() {

    var notices = this._notices.slice(0); // array copy

    notices.sort(function (a, b) { // notices[0] will be the oldest notice
       return a.id - b.id;
    });

    return this._url + "?max_id=" + notices[0].id + '&count=21';
};

/**
 * Trim the notice cache for this timeline.  Hard limit of 200 notices per
 * timeline, and trim anything older than 72 hours.
 *
 * @todo Don't trim the cache if we're offline.
 */
StatusNet.Timeline.prototype.trimNotices = function() {

    // Remove notices older than 72 hours from cache
    // @todo Make cache window configurable and tune the defaults

    // NOTE: I'm using integer timestamps because Titanium seems to blow up when
    // using SQLite's date functions :(

    var now = new Date();
    var cutoff = new Date();
    cutoff.setTime(now.getTime() - (86400 * 3 * 1000));

    StatusNet.debug(
        "Clearing out old cache entries for timeline " +
        this.timeline_name +
        " (NOW = " +
        now.getTime() +
        ", CUTOFF = " +
        cutoff.getTime() +
        ")"
    );

    try {

        var rs = this.db.execute(
            "DELETE FROM entry_asjson WHERE timestamp < ? AND timeline = ? AND account_id = ? ",
            cutoff.getTime(),
            this.timeline_name,
            this.account.id
        );

        // Also keep an absolute maximum of 200 notices per timeline
        rs = this.db.execute(
            "SELECT count(*) FROM entry_asjson WHERE timeline = ? AND account_id = ?",
            this.timeline_name,
            this.account.id
        );

        if (rs.isValidRow()) {
            var count = rs.fieldByName("count(*)");
            rs.close();
            StatusNet.debug("COUNT = " + count);

            if (count > 200) {
                var diff = (count - 200);

                rs = this.db.execute(
                    "DELETE FROM entry_asjson WHERE notice_id IN " +
                    "(SELECT notice_id FROM entry_asjson WHERE timeline = ? AND account_id = ? ORDER BY timestamp ASC LIMIT ?)",
                    this.timeline_name,
                    this.account.id,
                    diff
                );
            }
        }

    } catch (e) {
        StatusNet.debug("Caught Exception doing notice trim: " + e);
    }
    StatusNet.debug("trimNotices DONE");
};
/**
 * Whether to cache this timeline - may be overrided by timelines
 * we can't or don't want to cache ATM
 */
StatusNet.Timeline.prototype.cacheable = function() {
    return true;
};

/**
 * Do anything that needs doing after retrieving timeline data.
 */
StatusNet.Timeline.prototype.finishedFetch = function(notice_count) {

    // only empty if our timeline name matches the current active view's timeline name
    if (this.timeline_name === this.client.getActiveView().timeline.timeline_name) {
        if (this._notices.length === 0) {
            StatusNet.debug("Show empty timeline msg");
            this.client.getActiveView().showEmptyTimeline();
        }
    }

    if (this.cacheable()) {
        this.trimNotices();
    }

    StatusNet.AvatarCache.trimAvatarCache();
};

StatusNet.Timeline.prototype.getNotices = function() {
    return this._notices;
};

StatusNet.Timeline.prototype.getNotice = function(id) {
    var notices = this._notices;
    for (var i = 0; i < notices.length; i++) {
        if (notices[i].id == id) {
            return notices[i];
        }
    }
    throw "Notice ID " + id + " not on current timeline.";
};

/**
 * Loads and triggers display of cached notices on this timeline.
 * Accessor for notices
 *
 * @return Array an array of notices
 */
StatusNet.Timeline.prototype.loadCachedNotices = function() {
    var that = this;

    StatusNet.debug("Account ID = " + this.account.id);
    StatusNet.debug("Timeline name = " + this.timeline_name);
    var count = 100; // XXX: You always have to push the "more" button if you have more than this

    // Only pull 20 from the cache for mobile -- parsing more than that
    // slows things down too much.
    if (StatusNet.Platform.isMobile()) {
        count = 20;
    }

    var n;

    try {

        // @fixme grab count + 1 so we know if there's more to fetch
        var sql = "SELECT notice_id, json_entry, account_id, timeline, timestamp FROM entry_asjson " +
            "WHERE entry_asjson.account_id = ? AND entry_asjson.timeline = ? " +
            "ORDER BY entry_asjson.notice_id DESC " +
            "LIMIT " + count;

        var rs = this.db.execute(sql,
            this.account.id,
            this.timeline_name
        );
        n = StatusNet.rowCount(rs);

        while (rs.isValidRow()) {
            var notice;
            var jsonEntry = rs.fieldByName('json_entry');
            if (jsonEntry) { // if we have json data, use that
                notice = JSON.parse(jsonEntry);
                StatusNet.debug("using JSON data for entry "+rs.fieldByName('notice_id'));
                this.addNotice(notice, {
                    cache: false
                });
            }
            rs.next();
        }
        rs.close();

    } catch (e) {
         StatusNet.debug("encacheNotice - Oh no, I couldn't cache the entry: " + e);
    }

    StatusNet.debug('Timeline.loadCachedNotices loaded ' + n + ' cached notices.');
    return this._notices;
};

/**
 * Whether to automatically reload
 */
StatusNet.Timeline.prototype.autoRefresh = function() {
    return true;
};

/**
 * Constructor for mentions timeline model
 */
StatusNet.TimelineMentions = function(client) {
    StatusNet.Timeline.call(this, client);

    this.timeline_name = 'mentions';

    this._url = 'statuses/mentions.as';

};

// Make StatusNet.TimelineMentions inherit Timeline's prototype
StatusNet.TimelineMentions.prototype = heir(StatusNet.Timeline.prototype);

/**
 * Constructor for public timeline model
 */
StatusNet.TimelinePublic = function(client) {
    StatusNet.Timeline.call(this, client);

    this.timeline_name = 'public';

    this._url = 'statuses/public_timeline.as';

};

// Make StatusNet.TimelinePublic inherit Timeline's prototype
StatusNet.TimelinePublic.prototype = heir(StatusNet.Timeline.prototype);

/**
 * Constructor for favorites timeline model
 */
StatusNet.TimelineFavorites = function(client) {
    StatusNet.Timeline.call(this, client);

    this.timeline_name = 'favorites';

    this._url = 'favorites.as';

};

// Make StatusNet.TimelineFavorites inherit Timeline's prototype
StatusNet.TimelineFavorites.prototype = heir(StatusNet.Timeline.prototype);

/**
 * Constructor for tag timeline model
 */
StatusNet.TimelineTag = function(client, tag) {
    StatusNet.Timeline.call(this, client);

    StatusNet.debug("TimelineTag constructor - tag = " + tag);

    this._url = 'statusnet/tags/timeline/' + tag + '.as';

    this.tag = tag;
    this.timeline_name = 'tag-' + this.tag;

    StatusNet.debug("TimelineTag constructor - timeline name: " + this.timeline_name);

    StatusNet.debug("Tag timeline URL = " + this._url);
};

// Make StatusNet.TimelineTag inherit Timeline's prototype
StatusNet.TimelineTag.prototype = heir(StatusNet.Timeline.prototype);

// XXX: Turns out StatusNet's TAG timeline doesn't respect the since_id so
// until we fix it, I'm going to disable caching of tag timelines --Z
StatusNet.TimelineTag.prototype.cacheable = function() {
    return false;
};
