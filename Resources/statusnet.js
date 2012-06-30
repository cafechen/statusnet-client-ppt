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
/** StatusNet Namespace -- maybe we should just use SN? */
function StatusNet() {};

/**
 * Live database connection for local storage, if opened.
 * Most callers should rather use getDB().
 * @access private
 */
StatusNet.db = null;

/**
 * Abstracted debug interface; for Desktop version calls Titanium's debug func.
 * @param string msg
 * @return void
 */
StatusNet.debug = function(msg) {
    Titanium.API.debug(msg);
};

StatusNet.error = function(msg) {
    Titanium.API.error(msg);
};

/**
 * Lazy-open our local storage database.
 * @fixme move table definitions to shared code
 * @return database object
 */
StatusNet.getDB = function() {

    if (this.db === null) {

        this.db = Titanium.Database.open('statusnet');

        /*
            we don't use this anymore
        */
        var sql = 'DROP TABLE IF EXISTS notice_entry';
        var rs = this.db.execute(sql);
        sql = 'DROP TABLE IF EXISTS entry';
        rs = this.db.execute(sql);


        // for testing
        sql = 'DROP TABLE IF EXISTS entry_asjson';
        rs = this.db.execute(sql);

        sql = 'CREATE TABLE IF NOT EXISTS account (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
            'username TEXT NOT NULL, ' +
            'password TEXT NOT NULL, ' +
            'apiroot TEXT NOT NULL, ' +
            'is_default INTEGER DEFAULT 0, ' +
            'profile_image_url TEXT, ' +
            'text_limit INTEGER DEFAULT 0, ' +
            'nickname TEXT NOT NULL, ' +
            'site_logo TEXT, ' +
            'UNIQUE (username, apiroot)' +
            ')';

        rs = this.db.execute(sql);

        sql = 'CREATE TABLE IF NOT EXISTS entry_asjson (' +
            'notice_id INTEGER NOT NULL, ' +
            'json_entry TEXT, ' +
            'account_id INTEGER NOT NULL, ' +
            'timeline TEXT NOT NULL, ' +
            'timestamp INTEGER NOT NULL, ' +
            'PRIMARY KEY (notice_id)' +
            ')';

        rs = this.db.execute(sql);

        /*
            create indexes on entry table
        */
        sql = "CREATE INDEX IF NOT EXISTS notice_id_idx ON entry_asjson (notice_id)";
        rs = this.db.execute(sql);
        sql = "CREATE INDEX IF NOT EXISTS account_id_idx ON entry_asjson (account_id)";
        rs = this.db.execute(sql);
        sql = "CREATE INDEX IF NOT EXISTS timeline_idx ON entry_asjson (timeline)";
        rs = this.db.execute(sql);
        sql = "CREATE INDEX IF NOT EXISTS timestamp_idx ON entry_asjson (timestamp)";
        rs = this.db.execute(sql);

        sql = 'CREATE TABLE IF NOT EXISTS search_history (' +
            'searchterm TEXT NOT NULL' +
            ')';

        rs = this.db.execute(sql);

        if (rs) {
            rs.close();
        }
    }

    return this.db;
};

/**
 * Abstract away completely gratuitous differences between database result
 * classes in Titanium Desktop and Mobile. Sigh.
 *
 * @param Titaniu.Database.ResultSet rs
 * @return int
 */
StatusNet.rowCount = function(rs) {
    if (rs && typeof rs === "object") {
        return rs.rowCount;
    } else {
        return 0;
    }
};

/**
 * Utility function to create a prototype for the subclass
 * that inherits from the prototype of the superclass.
 */
function heir(p) {
    function f(){}
    f.prototype = p;
    return new f();
};

StatusNet.Event = function(sender) {
    StatusNet.debug("registering new event");
    this._sender = sender;
    StatusNet.debug("sender = " + sender);
    this._listeners = [];
};

StatusNet.Event.prototype.attach = function(listener) {
    StatusNet.debug("Attaching event listener");
    this._listeners.push(listener);
};

StatusNet.Event.prototype.notify = function(args) {
    if (args) {
        // no JSON on mobile
        //StatusNet.debug("Notify called with arg: " + Titanium.JSON.stringify(args));
        //StatusNet.debug("Notify called with arg: " + args);
    }
    for (var i = 0; i < this._listeners.length; i++) {
        this._listeners[i].call(this._sender, args);
    }
};

/**
 * Wrapper functions wooo
 */
StatusNet.Platform = {
    /**
     * Check the most appropriate size to fetch avatars for inline use
     * @return number
     */
    avatarSize: function() {
        if (StatusNet.Platform.dpi >= 240) {
            return 96;
        } else {
            return 48;
        }
    },

    dpi: Titanium.Platform.displayCaps.dpi,

    isApple: function() {
        return Titanium.Platform.osname == "iphone" || Titanium.Platform.osname == "ipad";
    },

    isAndroid: function() {
        return Titanium.Platform.osname == "android";
    },

    isMobile: function() {
        return (StatusNet.Platform.isApple() || StatusNet.Platform.isAndroid());
    },

    // @fixme add Android tablet detection
    isTablet: function() {
        return Titanium.Platform.osname == "ipad";
    },

    /**
     * Returns an appropriate background color for dialog box-style screens
     * on the current platform.
     *
     * @return string
     */
    dialogBackground: function() {
        if (this.isAndroid()) {
            // Android dialogs are mostly white-on-black
            return "black";
        } else if (this.isApple()) {
            // iOS likes a light gray-bluish BG
            return "#bbbfcc";
        }
        return "#eee"; // ???
    },

    /**
     * Check if a camera is available on this system. Hopefully.
     * @return boolean
     */
    hasCamera: function() {
        if (this.isAndroid()) {
            // Camera detection is not implemented on Android.
            // Just assume one exists for now?
            // https://appcelerator.lighthouseapp.com/projects/32238/tickets/993-titaniummediaiscamerasupported-not-implemented
            return true;
        }
        return Titanium.Media.isCameraSupported;
    }
};
StatusNet.Platform.hasNavBar = StatusNet.Platform.isApple;
StatusNet.Platform.hasMenu = StatusNet.Platform.isAndroid;

StatusNet.Platform.prepAnimation = function(dir) {
    var screenHeight = Titanium.Platform.displayCaps.platformHeight;
    var inPosition = Ti.UI.create2DMatrix();
    if (dir == 'up') {
        var downBelow = Ti.UI.create2DMatrix().translate(0, screenHeight);
        return {start: downBelow, end: inPosition};
    } else if (dir == 'down') {
        var upTop = Ti.UI.create2DMatrix().translate(0, -screenHeight);
        return {start: upTop, end: inPosition};
    }
};

StatusNet.Platform.animatedOpen = function(window, dir, target) {

    if (StatusNet.Platform.isApple()) {
    	window.close();
    	
        target = target || window;
        var states = StatusNet.Platform.prepAnimation(dir || 'up');
        target.transform = states.start;

        window.addEventListener('open', function() {
            target.animate({
                transform: states.end,
                duration: 500
            });
        });
    } else {
        // On Android, making sure this setting is present will
        // ensure we've got a heavyweight window, which is enabled
        // for the back button, and gets a sideways sliding animation.

        // UPDATE: this crashes on TiMo 1.5.1. skip it! -- Ed F Friday; January 28, 2011
        // window.fullscreen = window.fullscreen ? window.fullscreen : false;
    }
    window.open();
};

StatusNet.Platform.animatedClose = function(window, dir, target) {
    if (StatusNet.Platform.isApple()) {
        target = target || window;
        var states = StatusNet.Platform.prepAnimation(dir || 'up');

        target.transform = states.end;
        target.animate({
            transform: states.start,
            duration: 500
        }, function() {
            window.close();
        });
    } else {
        window.close();
    }
};

if (StatusNet.Platform.isApple()) {
    StatusNet.Platform.createNavBar = function(window, title) {

        var height = 44;
        var fontSize = 18;
        var spacer = Titanium.UI.createButton({
            systemButton: Titanium.UI.iPhone.SystemButton.FLEXIBLE_SPACE
        });

        var view = Titanium.UI.createToolbar({
            top: 0,
            left: 0,
            right: 0,
            height: height,
            borderTop: false,
            borderBottom: true,
            barColor: '#444',
            items: [spacer],
            zIndex: 200
        });
        window.add(view);

        var label = null;
        title = title || window.title;
        if (title != '') {
            label = Titanium.UI.createLabel({
                text: title,
                font: {fontSize: fontSize, fontWeight: 'bold'},
                minimumFontSize: 12, // only works on iOS currently
                textAlign: 'center',
                top: 4,
                height: height - 8,
                left: 60,
                right: 60,
                color: 'white',
                zIndex: 201
            });
            window.add(label);
        }

        var navbar = {
            view: view,
            _label: label,
            _left: null,
            _right: null,
            height: height,
            setLeftNavButton: function(button) {
                navbar.tweakStyle(button);
                navbar._left = button;
                navbar.updateItems();
            },
            setRightNavButton: function(button) {
                navbar.tweakStyle(button);
                navbar._right = button;
                navbar.updateItems();
            },
            setTitle: function(str) {
                label.text = str;
            },
            tweakStyle: function(button) {
                if (!button.style) {
                    button.style = Titanium.UI.iPhone.SystemButtonStyle.BORDERED;
                }
            },
            updateItems: function() {
                var items = [];
                if (navbar._left) {
                    items.push(navbar._left);
                }
                items.push(spacer);
                if (navbar._right) {
                    items.push(navbar._right);
                }
                navbar.view.items = items;
            }
        };

        return navbar;
    };

} else {

    StatusNet.Platform.createNavBar = function(window, title) {

        var height = 44;
        var fontSize = 18;

        var view = Titanium.UI.createView({
            top: 0,
            left: 0,
            right: 0,
            height: height,
            backgroundColor: "#bfc1c6",
            zIndex:200
        });
        window.add(view);

        title = title || window.title;
        var label = Titanium.UI.createLabel({
            text: title ? title : '',
            font: {fontSize: height / 2, fontWeight: 'bold'},
            textAlign: 'center',
            top: 4,
            bottom: 4,
            color: 'white'
        });
        view.add(label);

        var navbar = {
            view: view,
            _label: label,
            _left: null,
            _right: null,
            height: height,
            setLeftNavButton: function(button) {
                if (navbar._left) {
                    navbar.view.remove(navbar._left);
                }
                if (button) {
                    button.left = 4;
                    if (!button.height) {
                        button.top = 4;
                        button.bottom = 4;
                    }
                    if (!button.width) {
                        button.width = 75;
                    }
                    navbar.view.add(button);
                }
                navbar._left = button;
            },
            setRightNavButton: function(button) {
                if (navbar._right) {
                    navbar.view.remove(navbar._right);
                }
                if (button) {
                    button.right = 4;
                    if (!button.height) {
                        button.top = 4;
                        button.bottom = 4;
                    }
                    if (!button.width) {
                        button.width = 50;
                    }
                    navbar.view.add(button);
                }
                navbar._right = button;
            },
            setTitle: function(str) {
                label.text = str;
            }
        };

        return navbar;
    };
};

/**
 * Wrapper for platform-specific XML parser.
 *
 * @param string str
 * @return DOMDocument
 */
StatusNet.Platform.parseXml = function(str) {
    return Titanium.XML.parseString(str);
};

// Custom patch for feature request...
// https://appcelerator.lighthouseapp.com/projects/32238/tickets/1452-need-way-to-serialize-dom-trees-back-to-xml-on-mobile-save-xml-output
if (typeof Titanium.XML.serializeToString == "function") {
    /**
     * Wrapper for platform-specific XML output.
     *
     * @param DOMNode node
     * @return string
     */
    StatusNet.Platform.serializeXml = Titanium.XML.serializeToString;
};

StatusNet.Platform.setupLongClick = function(view, callback)
{
    var timer = null;
    var startEvent = null;
    var touchTimeout = 2000; // Hold for 2 seconds.

    // Hrmmmm in this multitouch world is this gonna cut it?
    view.addEventListener('touchstart', function(event) {
        StatusNet.debug('startEvent is: ' + startEvent);
        StatusNet.debug('timer is: ' + timer);
        if (startEvent) {
            // uhhhhhh?
            StatusNet.debug('long click restarted during run?...');
            /*
            clearTimeout(timer);
            timer = null;
            startEvent = null;
            return true;
            */
           return true;
        }

        startEvent = event;
        timer = setTimeout(function() {
            StatusNet.debug('long click triggered!');
            timer = null;
            startEvent = null;
            callback.call(view, {
                globalPoint: event.globalPoint,
                source: event.source,
                type: 'longclick',
                x: event.x,
                y: event.y
            });
            startEvent = null;
        }, touchTimeout);

        StatusNet.debug('long click timer started...');
        return true;
    });
    view.addEventListener('touchcancel', function(event) {
        if (startEvent) {
            StatusNet.debug('long click canceled.');
            clearTimeout(timer);
            timer = null;
            startEvent = null;
        }
        return true;
    });
    view.addEventListener('touchend', function(event) {
        if (startEvent) {
            StatusNet.debug('long click ended early');
            clearTimeout(timer);
            timer = null;
            startEvent = null;
        }
        return true;
    });
};

StatusNet.Platform.setInitialFocus = function(window, control)
{
    if (StatusNet.Platform.isAndroid()) {
        // If we set this on iPhone, it explodes and fails. :P
        // Need to set it on Android to force the window to size to fit
        // the screen area limited by the software keyboard, since we
        // can't predict its height.
        window.windowSoftInputMode =
            Ti.UI.Android.SOFT_INPUT_ADJUST_RESIZE +
            Ti.UI.Android.SOFT_INPUT_STATE_VISIBLE;

        window.addEventListener('open', function() {
            // set focus to the text entry field
            control.focus();
        });
    } else {
        window.addEventListener('open', function() {
            // Wait a quarter second to start to give our
            // open-window animation a chance to go. When
            // it's around halfway we'll start opening the
            // keyboard.
            setTimeout(function() {
                // set focus to the text entry field and
                // start opening the on-screen keyboard
                control.focus();
            }, 220);
        });
    }
};

/**
 * Wrapper for platform-specific Base-64 encoding.
 * Mysteriously this is in a different module on
 * Titanium Desktop and Titanium Mobile... and
 * has a different name too! Seriously?
 */
StatusNet.Platform.base64encode = function(data) {
    return Titanium.Utils.base64encode(data);
};

StatusNet.Platform.defaultSourceName = function() {
    if (StatusNet.Platform.isApple()) {
        return 'StatusNet iPhone';
    } else if (StatusNet.Platform.isAndroid()) {
        return 'StatusNet Android';
    } else {
        // Mystery platform...?!?! :D
        return 'StatusNet Mobile';
    }
};

StatusNet.showNetworkError = function(status, xml, text, prefix) {
    var msg;
    if (xml != null && typeof xml == "object") {
        msg = $(xml).find('error').text();
    } else if (status == "exception") {
        msg = text;
    } else if (status == 401) {
        msg = 'Authorization error. If your password has changed, remove and recreate the account.';
    } else if (status == 0) {
        msg = 'Unknown network error.';
    } else if (status) {
        msg = 'HTTP ' + status + ' error.';
    } else {
        msg = "Unknown error: " + text;
    }
    StatusNet.error(prefix + msg);
    StatusNet.Infobar.flashMessage(prefix + msg);
};


/*
@author: Remy Sharp / http://remysharp.com
@date: 2007-04-20
@name: time
@methods:
  start - start named timer
  stop - stop named timer
  event - hook predefined event
  func - hook existing function, or hook anonymous function (note refrence is passed back)
  report - output timings


  Sunday; February 13, 2011 - modified default report EF
*/
(function() {
  StatusNet.time = {
    // start + stop taken from firebuglite.js - http://getfirebug.com/firebuglite
    start: function(name) {
      if (!name) {
        error('start: If starting a timer manually a name must be set');
      } else {
        timeMap[name] = (new Date()).getTime();
      }
    },

    stop: function(name) {
      if (name in timeMap) {
        var stop = (new Date()).getTime();
        var l = new Report(name, timeMap[name], stop);
        log.push(l);
        if (lineReport) lineReportMethod.call(this, l);
        delete timeMap[name];
      } else {
        error('stop:' + name + ' not found');
      }
    },

    event: function(name, elm, type) {
      if (typeof name != 'string') {
        // name has not been passed in
        type = elm;
        elm = name;
        name = '';
      }

      if (!elm.length) {
        elm = [elm];
      }

      if (type.indexOf('on') == -1) {
        type = 'on' + type;
      }

      var i = elm.length;
      var timerN = null;
      var c = null;
      while (i--) {
        timerN = name;
        if (!timerN) {
          timerN = elm[i].id || elm[i].getAttribute('class') || elm[i].getAttribute('className') || elm[i].tagName;
        }

        mapEvent(elm[i], type, timerN);
      }
    },

    func: function(name, fn) {
      if (typeof name == 'function') {
        fn = name;
      }

      // get function name as this browser may not support fn.name (IE + Safari + Opera)
      if (!fn.name && typeof fn == 'function') {
        var m = fn.toString().match(/function\s*(.*)\s*\(/);
        if (m[1]) {
          fn.name = m[1];
        }
      }

      if (typeof fn == 'function' && !fn.name) {
        // function is anonymous -
        // time function using var func = time.fn(function() { ...do stuff });
        if (typeof name != 'string') {
          anonFuncId++;
          name = 'anonymous' + anonFuncId;
        }

        return function() {
          StatusNet.time.start(name);
          var ret = fn.apply(window, arguments);
          StatusNet.time.stop(name);
          return ret;
        };
      } else {
        var fnName = fn.name || fn;
        if (typeof name != 'string') {
          name = fnName;
        }

        eval('var fnCopy = ' + fnName);
        if (typeof fnCopy == 'function') {
          var wrap = function() {
            StatusNet.time.start(name);
            var ret = fnCopy.apply(this, arguments);
            StatusNet.time.stop(name);
            return ret;
          };
          wrap.hooked = true;
          eval(fnName + ' = wrap;');
          return eval(fnName);
        } else {
          // error hooking
          error('func: Could not hook function (name: ' + name + ')');
        }
      }
    },

    report: function(name) {
      if (typeof name == 'undefined') {
        reportMethod.call(this, log);
      } else {
        var i = log.length;
        var l = [];
        while (i--) {
          if (name == log[i].name) {
            l.push(log[i]);
          }
        }
        reportMethod.call(this, l);
      }
    },

    setReportMethod: function(fn) {
      if (fn.hooked) {
        error('setReportMethod: Cannot use hooked method ' + fn.name);
      } else {
        reportMethod = fn;
      }
    },

    setLineReportMethod: function(fn) {
      if (fn.hooked) {
        error('setLineReportMethod: Cannot use hooked method ' + fn.name);
      } else {
        lineReportMethod = fn;
        lineReport = true;
      }
    },

    errors: false
  };

  function defaultLineReport(l) {
      StatusNet.debug(l);
  }

  function defaultReport(l) {
    StatusNet.debug(l.join("\n"));

    var totals = {};
    var avgs = {};
    for (var i=0; i < l.length; i++) {
      if (!totals[l[i].name]) {
          totals[l[i].name] = l[i].delta;
      } else {
          totals[l[i].name] += l[i].delta;
      }
      avgs[l[i].name] = totals[l[i].name]/i;
    }

    for (var key in totals) {
        StatusNet.error("totals["+key+"]: " + totals[key] + "ms :: avg:"+avgs[key]+"ms");
    }
  }

  var timeMap = {};
  var log = [];
  var reportMethod = defaultReport;
  var lineReport = false;
  var lineReportMethod = defaultLineReport;
  var anonFuncId = 0;

  var Report = function(n, s, e) {
    this.name = n;
    this.start = s;
    this.stop = e;
    this.delta = e - s;
    // useful if I could grab the call - but can't see how due to anon functions (though I can see them in the start method)
  };

  Report.prototype.toString = function() {
    return this.name + ": " + this.delta + "ms";
  };

  function error(e) {
      if (StatusNet.time.errors) {
          StatusNet.error(e);
      }
  }

  // required to create a brand new instance of our copied function
  function mapEvent(e, t, n) {
    var c = e[t];
    if (typeof c == 'function') {
      e[t] = function() {
          StatusNet.time.start(n + ':' + t);
          var ret = c.apply(this, arguments);
          StatusNet.time.stop(n + ':' + t);
          return ret;
      };
    } else {
      error('event: Function must be set on element.' + t + ' before hooking (name: ' + n + ')');
    }
  }
})();
