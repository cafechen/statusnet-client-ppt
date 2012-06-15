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
 * Account info management constructor.
 *
 * @param string username
 * @param string password
 * @param string apiroot API base URL, eg 'http://identi.ca/api'
 * @return StatusNet.Account object
 */
StatusNet.Account = function(username, password, apiroot, nickname) {

    StatusNet.debug('in StatusNet.Account()');

    this.username = username;
    this.password = password;
    this.apiroot  = apiroot;
    this.nickname = nickname;
};

/**
 * Load up the default account's credentials from the local database,
 * if any.
 *
 * @return mixed StatusNet.Account object or null
 */
StatusNet.Account.getDefault = function(db) {

    StatusNet.debug('in StatusNet.Account.getDefault()');

    var row;

    try {
        row = db.execute('select * from account where is_default = 1');

        if (row.isValidRow()) {
            StatusNet.debug('found an account');
            var acct = StatusNet.Account.fromRow(row);
            row.close();
            return acct;
        } else {
            StatusNet.debug('did not find an account');
            row.close();
            return null;
        }
    } catch (e) {
        if (row) {
            row.close();
        }
        StatusNet.debug('Exception getting account: ' + e);
        return null;
    }
};

/**
 * Load up the a given account's full data by id.
 *
 * @return mixed StatusNet.Account object or null
 */
StatusNet.Account.getById = function(id) {
    var db = StatusNet.getDB();
    try {
        StatusNet.debug("%%%%%%%%%%%%%% looking up account");
        var row = db.execute('select * from account where id=?', id);

        if (row && row.isValidRow()) {
            StatusNet.debug('found an account for id ' + id);
            var acct = StatusNet.Account.fromRow(row);
            // @FIXME UI-specific code needs to be moved!
            // Do not uncomment this, it breaks on Android now.
            /*
            if (typeof Titanium.Desktop != "undefined") {
                $('ul.nav li#nav_timeline_profile > img').attr('src', acct.avatar);
            }
            */
            StatusNet.debug("%%%%%%%%%%%%%% closing account row");

            row.close();
            StatusNet.debug("%%%%%%%%%%%%%% returning account");

            return acct;
        } else {
            StatusNet.debug('did not find an account for id ' + i);
            row.close();
            return null;
        }
    } catch (e) {
        if (row && (typeof row == "object")) {
            row.close();
        }
        StatusNet.debug('Exception getting account for id ' + id + ': ' + e);
        return null;
    }
};

/**
 * Set this account as the default.
 */
StatusNet.Account.prototype.setDefault = function(db) {

    var rs;

    try {
        rs = db.execute("update account set is_default=0 where is_default=1");
        rs = db.execute("update account set is_default=1 where username=? and apiroot=?",
            this.username, this.apiroot);
        if (rs && (typeof rs == "object")) {
            rs.close();
        }
    } catch (e) {
        if (rs && (typeof rs == "object")) {
            rs.close();
        }
        StatusNet.debug("Exception setting default account: " + e);
    }
};

/**
 * Load an Account object from a database row w/ info
 * @param Titanium.Database.ResultSet row
 * @return StatusNet.Account object
 */
StatusNet.Account.fromRow = function(row) {

    var ac = new StatusNet.Account(
        row.fieldByName("username"),
        row.fieldByName("password"),
        row.fieldByName("apiroot"),
        row.fieldByName("nickname")
    );

    ac.id = row.fieldByName("id");
    ac.avatar = row.fieldByName("profile_image_url");
    ac.textLimit = row.fieldByName('text_limit');
    ac.siteLogo = row.fieldByName('site_logo');

    return ac;
};

/**
 * Load up all configured accounts from the database, if any.
 *
 * @return array of StatusNet.Account objects
 */
StatusNet.Account.listAll = function(db) {

    try {
        var accounts = [];

        var result = db.execute('select * from account');
        while (result.isValidRow()) {
            accounts[accounts.length] = StatusNet.Account.fromRow(result);
            result.next();
        }
        if (result && (typeof result === "object")) {
            result.close();
        }
        return accounts;
    } catch (e) {
        if (result && (typeof result === "object")) {
            result.close();
        }
        StatusNet.debug("Exception setting getting accounts: " + e);
        return null;
    }
};

/**
 * HTTP GET an API resource using the crendials for this account
 *
 * @param String   method    API method to call -- will be appended to the API root
 * @param callable onSuccess callback function called after successful HTTP fetch: function(status, response)
 * @param callable onError   callback function called if there's an HTTP error: function(status, response)
 *
 */
StatusNet.Account.prototype.apiGet = function(method, onSuccess, onError) {
    StatusNet.HttpClient.webRequest(this.apiroot + method, onSuccess, onError, null, this.username, this.password);
};

/**
 * HTTP POST to an API resource using the crendials for this account
 *
 * @param String   method    API method to call -- will be appended to the API root
 * @param mixed    data      any POST data, as either raw string or dictionary of key-value pairs; values that are blobs will be uploaded as attachments
 * @param callable onSuccess callback function called after successful HTTP fetch: function(status, response)
 * @param callable onError   callback function called if there's an HTTP error: function(status, response)
 *
 */
StatusNet.Account.prototype.apiPost = function(method, data, onSuccess, onError) {
    StatusNet.HttpClient.webRequest(this.apiroot + method, onSuccess, onError, data, this.username, this.password);
};

StatusNet.Account.prototype.fetchAvatar = function(size, username, file, onSuccess, onFailure) {
    var avatar_url = this.apiGetAvatarURL(size, username);

    StatusNet.HttpClient.fetchFile(
        avatar_url,
        file,
        onSuccess,
        onFailure
    );
};

/**
 * return the URL for the avatar. Uses the /users/profile_image/:username.json?size=:size method
 *
 * @param {string} [size] size. 'mini', 'normal', 'bigger'. Default 'normal'
 * @param {string} [username] the username. default is this.username (currently active user)
 * @returns {string} the URL for the avatar
 */
StatusNet.Account.prototype.apiGetAvatarURL = function(size, username) {
    if (!size || (['bigger', 'normal', 'mini'].indexOf(size) !== -1))  { size = 'normal'; }

    if (!username) { username = this.username; }

    var url = this.apiroot + '/users/profile_image/'+this.username+'.json?size='+size;

    return url;
};

/**
 * uploads a file to the statusnet server.
 *
 * This was specialized enough to not create a generic HTTP client method
 *
 * @param {String} path the file path
 * @param {Function} onSuccess on success callback. takes param (status, responseText)
 * @param {Function} onError on error callback. takes (status, responseText)
 * @param {Function} [onProgress] on progress callback. takes (event); event.progress has progress value
 */
StatusNet.Account.prototype.apiUploadFile = function(path, onSuccess, onError, onProgress) {
    var fs = Titanium.Filesystem.getFileStream(path);
    fs.open(Titanium.Filesystem.MODE_READ);
    var bytes = fs.read();
    fs.close();

    var xhr = Titanium.Network.createHTTPClient();

    xhr.onsendstream = function(e) {
        StatusNet.debug('onsendstream', e.progress);
        StatusNet.debug(xhr.dataSent());
        if (onProgress) { onProgress(e); }
    };
    xhr.onerror = function(e) {
        StatusNet.error('ERROR', e);
        onError(xhr.status, xhr.responseText);
    };
    xhr.onload = function(e) {
        StatusNet.debug('Success');
        onSuccess(xhr.status, xhr.responseText);
    };
    xhr.open('POST', this.apiroot + '/statusnet/media/upload');
    xhr.setRequestHeader('Authorization', 'Basic ' + Titanium.Codec.encodeBase64(this.username + ':' + this.password));
    xhr.setRequestHeader("content-type", "multipart/form-data");
    xhr.send({
        media:bytes
    });
};

/**
 * Make sure we've recorded account credentials to the local database.
 * If not already done, saves them.
 *
 * @return boolean success
 */
StatusNet.Account.prototype.ensure = function(db) {

    StatusNet.debug('in Account.ensure');

    StatusNet.debug("Avatar = " + this.avatar);
    StatusNet.debug("textLimit = " + this.textLimit);
    StatusNet.debug("siteLogo = " + this.siteLogo);

    var rs;

    try {

        rs = db.execute("select * from account where username=? " +
                        "and apiroot=?",
                        this.username, this.apiroot);

        if (StatusNet.rowCount(rs) === 0) {
            db.execute("INSERT INTO account " +
                       "(username, password, apiroot, is_default, profile_image_url, text_limit, nickname, site_logo) " +
                       "VALUES (?, ?, ?, 0, ?, ?, ?, ?)",
                       this.username,
                       this.password,
                       this.apiroot,
                       this.avatar,
                       this.textLimit,
                       this.nickname,
                       this.siteLogo);

            StatusNet.debug('inserted new account');
        }

        rs = db.execute("select * from account where username=? " +
                        "and apiroot=?",
                        this.username,
                        this.apiroot);

        if (rs && rs.isValidRow()) {
            var id = rs.fieldByName("id");
            rs.close();
            return id;
        } else {
            if (rs && (typeof rs === "object")) {
                rs.close();
            }
            return false;
        }

    } catch (e) {
        if (rs && (typeof rs === "object")) {
            rs.close();
        }
        StatusNet.debug('ensure() - Exception saving credentials: ' + e);
        return false;
    }
};

/**
 * Is this the same?
 *
 * @param mixed other a StatusNet.Account or null
 * @return boolean
 */
StatusNet.Account.prototype.equals = function(other) {
    if (other == null || typeof other != "object") {
        return false;
    }
    return (typeof other == "object" &&
            this.username == other.username &&
            this.password == other.password &&
            this.apiroot == other.apiroot);
};

/**
 * Remove this account from the database, should it exist!
 * If we removed the default account, we'll set the first next available
 * account as the new default.
 */
StatusNet.Account.prototype.deleteAccount = function() {

    var db = StatusNet.getDB();
    var row = null;

    try {

        StatusNet.debug("deleting...");
        db.execute("delete from account where username=? and apiroot=?",
                   this.username, this.apiroot);
        StatusNet.debug("deleted.");

        StatusNet.debug("checking default...");
        if (StatusNet.Account.getDefault(db) == null) {
            StatusNet.debug("setting new default...");
            // Set the first one we find as default if we removed the default...
            row = db.execute("select * from account limit 1");
            if (row && row.isValidRow()) {
                var acct = StatusNet.Account.fromRow(row);
                row.close();
                acct.setDefault();
            } else {
                if (row && (typeof row === "object")) {
                    row.close();
                }
            }
            StatusNet.debug("new default set!");
        }
        StatusNet.debug("done deleting!");
    } catch (e) {
        if (row && (typeof row === "object")) {
            row.close();
            StatusNet.debug('Exception deleting account: ' + e);
        }
    }
};

/**
 * Get an attractive description of the hostname
 * @return string
 */
StatusNet.Account.prototype.getHost = function() {
    var matches = this.apiroot.match(/^(http|https):\/\/([^\/]+)/);
    if (matches) {
        return matches[2];
    } else {
        // hmmm
        return this.apiroot;
    }
};

/**
 * Is this account set up with a secure connection?
 * @return boolean
 */
StatusNet.Account.prototype.isSecure = function() {
    return (this.apiroot.match(/^https:/));
};

/**
 * Accessor for this account's text limit
 */
StatusNet.Account.prototype.getTextLimit = function() {
    return this.textLimit;
};
