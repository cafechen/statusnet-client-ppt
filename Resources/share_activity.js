/**
 * StatusNet Mobile
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
// StatusNet



var sources = ['statusnet.js',

               'model/statusnet_httpclient.js',
               'model/statusnet_account.js',
               'model/statusnet_avatarcache.js',

               'view/statusnet_newnoticeview.js',
               'view/statusnet_directmessageview.js',

               'heyQuery.js'];

for (var i = 0; i < sources.length; i++) {
    Titanium.include(sources[i]);
}

var activity = Ti.Android.currentActivity;

activity.addEventListener("create", function(e) {
    var intent = e.source.getIntent();
    var options = {};
    StatusNet.debug("QQQQQQ: intent.type is " + intent.type);

    options.initialText = intent.getStringExtra(Ti.Android.EXTRA_TEXT);
    StatusNet.debug("QQQQQQ: initialText is " + options.initialText);

    options.attachment = intent.getData();
    StatusNet.debug("QQQQQQ: attachment is " + options.attachment);

    var view = new StatusNet.NewNoticeView(options);
    view.sent.attach(function() {
        activity.setResult(Ti.Android.RESULT_OK);
    });
    view.onClose.attach(function() {
        activity.finish();
    });
    view.init();
});
