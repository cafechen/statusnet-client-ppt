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
 * Constructor for new notice view
 */
StatusNet.NewNoticeView = function() { };

/**
 * Initialize the window -- add @-reply text if necessary
 */
StatusNet.NewNoticeView.prototype.init = function() {
    // post a new notice
    StatusNet.debug("NewNoticeView.init");

    this.config = StatusNet.Config.getConfig();
    var that = this;
    var me = Titanium.UI.getCurrentWindow();

    // set theme
    this.theme = me.client.getTheme();
    $("link#display").attr("href", this.theme.getDisplayStylesheet());
    $("link#new_notice").attr("href", this.theme.getNewNoticeStylesheet());

    // Add in a theme specific stylesheet if any
    var themeCss = this.theme.getThemeStylesheet();
    if (themeCss) {
        $('<link id="theme" rel="stylesheet" href="' + themeCss +
            '" type="text/css" charset="utf-8">').insertAfter($("link#display"));
    }

    if (me.replyToUsername) {
        $('textarea#notice_textarea').val('@' + me.replyToUsername + ' ');
        // set cursor position to after the @
        $('textarea#notice_textarea').selectRange(
            me.replyToUsername.length + 2,
            me.replyToUsername.length + 2
        );
    }

    $('#update_button')
        .attr('disabled', 'disabled')
        .val(L('update_button'));

    $('#update_button').bind('click', function(event) {
        that.postNotice();
    });

    $('#upload_button')
        .val(L('upload_button'));

    $('#upload_button').bind('click', function(event) {
        that.uploadAttachment();
    });

    var textLimit = me.client.getActiveAccount().getTextLimit();

    StatusNet.debug("textlimit = " + textLimit);

    $('#counter').html(textLimit);

    // Note: pressing a key doesn't generate a keypress event on
    // Linux version of Titanium.
    $('#notice_textarea').bind('keydown', function(event) {
        var len = $('#notice_textarea').val().length;

        if (len > 0 && $('#update_button').attr('disabled')) {
            $('#update_button').removeAttr('disabled');
        }

        if (len === 0) {
            $('#update_button').attr('disabled', 'disabled');
        }

        // turn char counter red when it goes negative
        if (textLimit - len < 0) {
            $('#counter').addClass('negative');
        }

        if (textLimit - len >= 0) {
            $('#counter').removeClass('negative');
        }

        $('#counter').html(textLimit - len);
    });

    // set focus to the text entry field
    $('textarea#notice_textarea').focus();
};

/**
 * Setup post parameters and post the notice
 */
StatusNet.NewNoticeView.prototype.postNotice = function()
{
    StatusNet.debug("NewNoticeView.postNotice()");

    var that = this;
    var method = 'statuses/update.xml';
    var noticeText = $('#notice_textarea').val();
    var base = 'status=' + encodeURIComponent(noticeText);
    var params = [];
    params.push('source=' + encodeURIComponent(StatusNet.Config.getConfig().getSourceName()));

    var me = Titanium.UI.getCurrentWindow();

    if (me.replyToId) {
        StatusNet.debug("replyToId = " + me.replyToId);
        params.push('in_reply_to_status_id=' + me.replyToId);
    }

    var postParams = base + '&' + params.join('&');

    StatusNet.debug("Sending these post parameters: " + postParams);

    me.client.getActiveView().showSpinner();
    $('#update_button').attr('disabled', 'disabled');
    me.client.getActiveAccount().apiPost(method, postParams,
        function(status, response) {
            var id = $(response).find('status > id').text();
            if (id) {
                if (that.config.playSounds() && !that.config.getSetting("postnotice_sound_off")) {
                    me.client.postNoticeSound.play();
                }
                StatusNet.debug("Posted notice " + id);
                me.client.getActiveTimeline().update(null, false);
                if (me.onSuccess) {
                    var msg;
                    if (me.replyToId) {
                        msg = String.format(L('posted_reply_to_notice'), me.replyToId);
                    } else {
                        msg = String.format(L('posted_notice'), id);
                    }
                    me.onSuccess(msg);
                }
            }
            me.client.getActiveView().hideSpinner();
            me.close();
        },
        function(status, response) {
            var err = $(response).find('error').text();
            var msg = L('error_posting');
            if (err) {
                msg += " - " + err;
            }
            $("#error").text(msg);
            StatusNet.debug(msg + ", status = " + status + ", response = " + response);
            me.client.getActiveView().hideSpinner();
        }
    );
};



/**
 * 
 */
StatusNet.NewNoticeView.prototype.uploadAttachment = function() {
    
    function onSuccess(status, response) {
        var textarea = $('#notice_textarea');
        
        $('#upload_progress').removeClass('active');
        $('#upload_button').attr('disabled', '');
        $('#notice_textarea').attr('disabled', '');
        me.client.getActiveView().hideSpinner();
        
        var shorturl = $(response).find('mediaurl').text();
        if (textarea.val().length > 0) {
            textarea.val( textarea.val() + ' ' + shorturl ); 
        } else {
            textarea.val(shorturl);
        }
    }
    
    
    function onError(status, response) {
        var err = $(response).find('error').text();
        var msg = L('error_posting');
        if (err) {
            msg += " - " + err;
        }
        $("#error").text(msg);
        $('#upload_progress').removeClass('active');
        $('#upload_button').attr('disabled', '');
        $('#notice_textarea').attr('disabled', '');
        StatusNet.debug(msg + ", status = " + status + ", response = " + response);
    }
    
    
    function onProgress(e) {
        // seems to be broken atm
    }
    
    
    var me = Titanium.UI.getCurrentWindow();
    
    me.openFileChooserDialog(function(files) {

        if (files && files.length > 0) {
            
            var path = files[0];
            var fileobj = Titanium.Filesystem.getFile(path);

            if (fileobj.exists() && fileobj.size() < 2000000) {

                $('#upload_progress').addClass('active');
                $('#upload_button').attr('disabled', 'disabled');
                $('#notice_textarea').attr('disabled', 'disabled');
                
                me.client.getActiveAccount().apiUploadFile(path, onSuccess, onError, onProgress);

            } else {

                var msg = L('error_posting');

                if (!fileobj.exists()) {

                    msg += " - file not found";

                } else if (!fileobj.size() < 2000000) {

                    msg += " - file too large";

                }

                $("#error").text(msg);
                StatusNet.debug(msg);

            }

        }

    }, {
        'multiple':false
    });

};