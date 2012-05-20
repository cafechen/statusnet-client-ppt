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

StatusNet.SettingsView = function(client) {

    var db = StatusNet.getDB();
    this.accounts = [];
    this.workAcct = null;
    this.updateTimeout = null;
    this.lastUsername = '';
    this.lastPassword = '';
    this.lastSite = '';
    this.client = client;
    this.rows = [];
    this.nickname = null ;

    this.onClose = new StatusNet.Event();
};

/**
 * Initialize the account settings view...
 * Creates a table view listing all configured accounts.
 */
StatusNet.SettingsView.prototype.init = function() {
    StatusNet.debug('SettingsView.init');
    var view = this;
    this.showingLongclickDialog = false;

    var window = this.window = Titanium.UI.createWindow({
        title: '企业微博',
        navBarHidden: true
    });

    window.addEventListener('StatusNet_SettingsView_showAccounts', function(event) {
        view.showAccounts();
        //view.client.switchPPTAccount();
    });

    // Stack the toolbar above the table view; this'll make our animation awesomer.
    // Set up our table view...
    this.table = Titanium.UI.createTableView({
        editable: true,
        top: 44, //this.navbar.height
        zIndex: 100
    });
    this.window.add(this.table);

    // @fixme drop the duped title if we can figure out why it doesn't come through
    this.navbar = StatusNet.Platform.createNavBar(this.window, 'Accounts');

    this.table.addEventListener('click', function(event) {
        // Selected an account

	    if (view.showingLongclickDialog) {
            StatusNet.debug("Long click dialog for deleting account is open; ignoring table click");
	        return;
	    }

        if (event.rowData.acct == "add-stub") {
            // Special case!
            view.showAddAccount();
            return;
        }

        // hack -- on Android, we don't seem to get the original object back
        // but only have its properties, so all the methods are missing.
        var x = event.rowData.acct;
        var acct = StatusNet.Account.getById(x.id);

        StatusNet.debug('Attempting to select account: ' + acct.username + '@' + acct.getHost());
        acct.setDefault(StatusNet.getDB());
        StatusNet.debug('Saved!');

        if (StatusNet.Platform.isAndroid()) {
            // Closing the window first seems to exacerbate synch bugs.
            // Blergh.
            StatusNet.debug('Switching to timeline...');
            view.table.enabled = false;
            view.client.switchAccount(acct);
            view.closeWindow();
        } else {
            // Start closing the current window...
            view.closeWindow();

            StatusNet.debug('Switching to timeline...');
            view.client.switchAccount(acct);
        }
    });
    this.table.addEventListener('delete', function(event) {
        // deleted a row
        var acct = event.rowData.acct;
        StatusNet.debug('Attempting to delete account: ' + acct.username + '@' + acct.getHost());
        view.deleteAccountRow(acct);
        view.rows = view.rows.splice(event.rowData.index, 1);
    });

    // And a cancel for account selection.
    // @fixme don't show this if we're running on first view!
    var cancel = Titanium.UI.createButton({
        title: 'Cancel'
    });
    cancel.addEventListener('click', function() {
        view.closeWindow();
    });

    if (StatusNet.Platform.isApple()) {
        // @fixme perhaps just use the native thingy here?
        // Create-account button
        var create = Titanium.UI.createButton({
            title: '+'
        });

        // Edit/done buttons for the table view...
        this.edit = Titanium.UI.createButton({
            title: 'Edit'
        });

        this.done = Titanium.UI.createButton({
            title: 'Done'
        });
        this.edit.addEventListener('click', function() {
            view.navbar.setRightNavButton(view.done);
            view.table.editing = true;
        });
        this.done.addEventListener('click', function() {
            view.navbar.setRightNavButton(view.edit);
            view.table.editing = false;
        });

        create.addEventListener('click', function() {
            if (view.table.editing) {
                view.table.editing = false;
                view.navbar.setLeftNavButton(view.edit);
            }
            view.showAddAccount();
        });

        // ...and plop them onto the tab header.
        this.navbar.setRightNavButton(this.edit);
    }

    // Now let's fill out the table!
    view.showAccounts();
    //view.client.switchPPTAccount();

    if (this.accounts.length > 0) {
        // We do the slide-up animation manually rather than
        // doing this as a modal, since that confuses things
        // when we open another modal later.
        this.navbar.setLeftNavButton(cancel);
        this.client.switchAccount(this.accounts[0]);
				this.closeWindow();
        //this.open();
    } else {
        // Leave the main accounts window hidden until later...
        this.showAddAccount(true);
    }
};

/**
 * Open the add-new-account modal dialog
 */
StatusNet.SettingsView.prototype.showRegister = function(noCancel) {
    var view = this;
    var window = Titanium.UI.createWindow({
        title: "企业微博",
        backgroundColor: StatusNet.Platform.dialogBackground(),
        navBarHidden: true // hack for iphone for now
    });

    var doClose = function() {

        // Hide keyboard...
        for (var i in view.fields) {
            if (view.fields.hasOwnProperty(i)) {
                var field = view.fields[i];
                if (typeof field.blur == 'function') {
                    field.blur();
                }
            }
        }

        view.fields = null;
        view.window.open();
        view.window.fireEvent('StatusNet_SettingsView_showAccounts');
        StatusNet.Platform.animatedClose(window);
    };

    // @fixme drop the duped title if we can figure out why it doesn't come through
    var navbar = StatusNet.Platform.createNavBar(window, '注册');

    var cancel = Titanium.UI.createButton({
        title: "Cancel"
    });
    cancel.addEventListener('click', function() {
        doClose();
    });
    
    // Check for empty fields. Sending an empty field into
    // verifyAccount causes Android to crash
    var checkForEmptyFields = function(onSuccess, onFail) {
        StatusNet.debug("Checking for empty fields in add account");
        //var site = view.fields.site.value;
        var site = 'a.pengpengtou.com'
        var username = view.fields.username.value;
        var password = view.fields.password.value;
        var verifyPassword = view.fields.verifyPassword.value;
        var verifyCode = view.fields.verifyCode.value;

        var bad = [];
        if (!site) {
            bad.push("Server");
        }
        if (!username) {
            bad.push('Username');
        }
        if (!password) {
            bad.push("Password");
        }
        if (!verifyPassword) {
            bad.push("verifyPassword");
        }
        if (!verifyCode) {
            bad.push("verifyCode");
        }

        var verb = "is";

        if (bad.length > 1) {
            verb = "are";
        }

        if (bad.length == 0) {
            onSuccess();
        } else {
            var msg = bad.join(', ') + ' ' + verb + " required.";
            onFail(msg);
        }
    };

    if (!noCancel) {
        navbar.setLeftNavButton(cancel);
    }
    
    //navbar.setRightNavButton(save);

    var workArea = Titanium.UI.createView({
        top: navbar.height,
        left: 0,
        right: 0,
        bottom: 0,
        layout: 'vertical'
    });
    
    window.add(workArea);

    this.fields = {};
    var commonProps = {
        left: 8,
        right: 8,
        height: StatusNet.Platform.isAndroid() ? 'auto' : 32, // argghhhhh auto doesn't work on iphone
        borderStyle: Titanium.UI.INPUT_BORDERSTYLE_ROUNDED,
        autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE,
        autocorrect: false
    };
    
    var fields = {
    		/*
        site: {
            label: "Server",
            props: {
                hintText: "example.status.net",
                returnKeyType:Titanium.UI.RETURNKEY_NEXT,
                keyboardType: Titanium.UI.KEYBOARD_URL
            }
        },*/
        username: {
            label: "手机号",
            props: {
            		keyboardType: Titanium.UI.KEYBOARD_EMAIL,
                returnKeyType: Titanium.UI.RETURNKEY_DONE
            }
        },
        password: {
            label: "密码",
            props: {
                passwordMask:true,
                keyboardType: Titanium.UI.KEYBOARD_EMAIL, // we need to specify *this* or the autocorrect setting doesn't get set on the actual field for Android?!
                returnKeyType:Titanium.UI.RETURNKEY_DONE
            }
        },
        verifyPassword: {
            label: "确认密码",
            props: {
                passwordMask:true,
                keyboardType: Titanium.UI.KEYBOARD_EMAIL, // we need to specify *this* or the autocorrect setting doesn't get set on the actual field for Android?!
                returnKeyType:Titanium.UI.RETURNKEY_DONE
            }
        },
        verifyCode: {
            label: "验证码",
            props: {
                keyboardType: Titanium.UI.KEYBOARD_EMAIL, // we need to specify *this* or the autocorrect setting doesn't get set on the actual field for Android?!
                returnKeyType:Titanium.UI.RETURNKEY_DONE
            }
        }
    };
    for (var i in fields) {
        if (fields.hasOwnProperty(i)) {
            var field = fields[i];
            var props = {};
            var slurp = function(source) {
                for (var j in source) {
                    if (source.hasOwnProperty(j)) {
                        props[j] = source[j];
                    }
                }
            };
            slurp(commonProps);
            slurp(field.props);

            var label = Titanium.UI.createLabel({
                left: 8,
                right: 8,
                height: 'auto',
                text: field.label
            });
            workArea.add(label);

            var text = Titanium.UI.createTextField(props);
            workArea.add(text);

            this.fields[i] = text;
        }
    }
    /*
    this.fields.site.addEventListener('return', function() {
        view.fields.username.focus();
    });
    */
    this.fields.username.addEventListener('return', function() {
        view.fields.password.focus();
    });
    this.fields.password.addEventListener('return', function() {
        view.fields.verifyPassword.focus();
    });
    this.fields.verifyPassword.addEventListener('return', function() {
        view.fields.verifyCode.focus();
    });
    this.fields.verifyCode.addEventListener('return', function() {
        register.fireEvent('click', {});
    });

    this.fields.status = Titanium.UI.createLabel({
        text: "",
        left: 8,
        right: 8,
        height: StatusNet.Platform.isAndroid() ? 'auto' : 32
    });
    
    workArea.add(this.fields.status);
    
    var login = Titanium.UI.createButton({
   		title: "登陆"
    });

    login.addEventListener('click', function() {
    		doClose();
        view.showAddAccount(true);
    });
    
    var register = Titanium.UI.createButton({
   		title: "注册"
    });

    register.addEventListener('click', function() {
        view.register(view);
    });
    
    var pasVerify = Titanium.UI.createButton({
   		title: "获取验证码"
    });
    
    pasVerify.addEventListener('click', function() {
        StatusNet.debug('clicked pasVerify');
        view.getVerifyCode();
    });
    
    workArea.add(pasVerify) ;
    workArea.add(login) ;
    workArea.add(register) ;

    //StatusNet.Platform.setInitialFocus(window, this.fields.site);
    StatusNet.Platform.animatedOpen(window);
};

/**
 * Open the add-new-account modal dialog
 */
StatusNet.SettingsView.prototype.showAddAccount = function(noCancel) {
	
    var view = this;
    var window = Titanium.UI.createWindow({
        title: "企业微博",
        backgroundColor: StatusNet.Platform.dialogBackground(),
        navBarHidden: true // hack for iphone for now
    });

    var doClose = function() {

        // Hide keyboard...
        for (var i in view.fields) {
            if (view.fields.hasOwnProperty(i)) {
                var field = view.fields[i];
                if (typeof field.blur == 'function') {
                    field.blur();
                }
            }
        }

        view.fields = null;
        view.window.open();
        view.window.fireEvent('StatusNet_SettingsView_showAccounts');
        StatusNet.Platform.animatedClose(window);
    };

    // @fixme drop the duped title if we can figure out why it doesn't come through
    var navbar = StatusNet.Platform.createNavBar(window, '登陆');

    var cancel = Titanium.UI.createButton({
        title: "Cancel"
    });
    cancel.addEventListener('click', function() {
        doClose();
    });
    
    // Check for empty fields. Sending an empty field into
    // verifyAccount causes Android to crash
    var checkForEmptyFields = function(onSuccess, onFail) {
        StatusNet.debug("Checking for empty fields in add account");
        //var site = view.fields.site.value;
        var site = 'a.pengpengtou.com'
        var username = view.fields.username.value;
        var password = view.fields.password.value;

        var bad = [];
        if (!site) {
            bad.push("Server");
        }
        if (!username) {
            bad.push('Username');
        }
        if (!password) {
            bad.push("Password");
        }

        var verb = "is";

        if (bad.length > 1) {
            verb = "are";
        }

        if (bad.length == 0) {
            onSuccess();
        } else {
            var msg = bad.join(', ') + ' ' + verb + " required.";
            onFail(msg);
        }
    };

    if (!noCancel) {
        navbar.setLeftNavButton(cancel);
    }
    
    //navbar.setRightNavButton(save);

    var workArea = Titanium.UI.createView({
        top: navbar.height,
        left: 0,
        right: 0,
        bottom: 0,
        layout: 'vertical'
    });
    
    window.add(workArea);

    this.fields = {};
    var commonProps = {
        left: 8,
        right: 8,
        height: StatusNet.Platform.isAndroid() ? 'auto' : 32, // argghhhhh auto doesn't work on iphone
        borderStyle: Titanium.UI.INPUT_BORDERSTYLE_ROUNDED,
        autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE,
        autocorrect: false
    };
    var fields = {
    		/*
        site: {
            label: "Server",
            props: {
                hintText: "example.status.net",
                returnKeyType:Titanium.UI.RETURNKEY_NEXT,
                keyboardType: Titanium.UI.KEYBOARD_URL
            }
        },*/
        username: {
            label: "手机号",
            props: {
                returnKeyType: Titanium.UI.RETURNKEY_NEXT,
                keyboardType: Titanium.UI.KEYBOARD_EMAIL
            }
        },
        password: {
            label: "密码",
            props: {
                passwordMask:true,
                keyboardType: Titanium.UI.KEYBOARD_EMAIL, // we need to specify *this* or the autocorrect setting doesn't get set on the actual field for Android?!
                returnKeyType:Titanium.UI.RETURNKEY_DONE
            }
        }
    };
    for (var i in fields) {
        if (fields.hasOwnProperty(i)) {
            var field = fields[i];
            var props = {};
            var slurp = function(source) {
                for (var j in source) {
                    if (source.hasOwnProperty(j)) {
                        props[j] = source[j];
                    }
                }
            };
            slurp(commonProps);
            slurp(field.props);

            var label = Titanium.UI.createLabel({
                left: 8,
                right: 8,
                height: 'auto',
                text: field.label
            });
            workArea.add(label);

            var text = Titanium.UI.createTextField(props);
            workArea.add(text);

            this.fields[i] = text;
        }
    }
    /*
    this.fields.site.addEventListener('return', function() {
        view.fields.username.focus();
    });
    */
    this.fields.username.addEventListener('return', function() {
        view.fields.password.focus();
    });
    this.fields.password.addEventListener('return', function() {
        login.fireEvent('click', {});
    });

    this.fields.status = Titanium.UI.createLabel({
        text: "",
        left: 8,
        right: 8,
        height: StatusNet.Platform.isAndroid() ? 'auto' : 32
    });
    
    workArea.add(this.fields.status);

    var login = Titanium.UI.createButton({
   		title: "登陆"
    });

    login.addEventListener('click', function() {
        StatusNet.debug('clicked login');
        login.enabled = false;
        checkForEmptyFields(function() {
      		view.checkAccount(view, function(){
      			StatusNet.debug('####stevenchen nickname2:');
      			view.verifyAccount(function() {
              StatusNet.debug('login click: updated');
              if (view.workAcct != null) {
                  // @fixme separate the 'update state' and 'login' actions better
                  view.saveNewAccount();
                  doClose();
              }
            },
            function() {
                StatusNet.debug("Could not verify account.");
                login.enabled = true;
            });
    	   	});
        },
        function(msg) {
            StatusNet.debug("Some required account fields were empty");
            var errDialog = Titanium.UI.createAlertDialog({
                title: 'Fields incomplete',
                message: msg,
                buttonNames: ['确认']
            });
            errDialog.show();
            login.enabled = true;
        });
    });
    
    var register = Titanium.UI.createButton({
   		title: "注册"
    });

    register.addEventListener('click', function() {
        StatusNet.debug('clicked register');
        //view.closeWindow() ;
        doClose();
        view.showRegister(true);
    });
    
    workArea.add(login) ;
    workArea.add(register) ;

    //StatusNet.Platform.setInitialFocus(window, this.fields.site);
    StatusNet.Platform.animatedOpen(window);
};

/**
 * @fixme really should separate this a bit more to model/view?
 */
StatusNet.SettingsView.prototype.showAccounts = function() {
    StatusNet.debug('SettingsView.showAccounts');

    this.accounts = StatusNet.Account.listAll(StatusNet.getDB());
    this.rows = [];
    
		if(this.accounts.length > 0){
			this.client.switchAccount(this.accounts[0]);
			this.closeWindow();
			return ;
		}
		
		return ;
    
    for (var i = 0; i < this.accounts.length; i++) {
        this.addAccountRow(this.accounts[i]);
    }

    // Stick an 'add account' item at the top of the list, similar to
    // the default Android browser's bookmarks list.
    var row = Titanium.UI.createTableViewRow({
        height: 64,
        editable: false,
        acct: "add-stub"
    });

    var variant = '';
    if (StatusNet.Platform.isAndroid()) {
        if (StatusNet.Platform.dpi == 240) {
            variant = '-android-high';
        } else {
            variant = '-android-medium';
        }
    }
    var avatar = Titanium.UI.createImageView({
        image: 'images/settings/add-account' + variant + '.png',
        top: 8,
        left: 8,
        width: 48,
        height: 48,
        canScale: true, // for Android
        enableZoomControls: false // for Android
    });
    row.add(avatar);

    var label = Titanium.UI.createLabel({
        text: 'Add account...',
        left: 80,
        top: 0,
        bottom: 0,
        right: 0,
        font: {
            fontSize: 18
        }
    });
    row.add(label);
    this.rows.push(row);

    this.table.setData(this.rows);
    
};

/**
 * Add an account row to the accounts list.
 * Avatar will start loading asynchronously, whee!
 *
 * @param StatusNet.Account acct
 */
StatusNet.SettingsView.prototype.addAccountRow = function(acct) {
    // todo: avatar
    // todo: better formatting
    // todo: secure state
    StatusNet.debug('show account row: ' + acct);
    var title = acct.username + '@' + acct.getHost();
    StatusNet.debug('adding row: ' + title);

    var row = Titanium.UI.createTableViewRow({
        acct: acct,
        height: 64
    });

    if (acct.avatar) {
        var avatar = Titanium.UI.createImageView({
            top: 0,
            left: 0,
            width: 56,
            height: 56,
            canScale: true, // for Android
            enableZoomControls: false // for Android
        });
        row.add(avatar);
        if (StatusNet.Platform.isAndroid()) {
            StatusNet.AvatarCache.lookupAvatar(acct.avatar, function(path) {
                avatar.image = path;
            });
        } else {
            // https://appcelerator.lighthouseapp.com/projects/32238-titanium-mobile/tickets/1680-ios-regression-imageview-loaded-from-local-file-no-longer-scales-in-current-git-build
            avatar.image = acct.avatar;
        }
    }

    if (acct.siteLogo) {
        var logo = Titanium.UI.createImageView({
            top: 40,
            left: 40,
            width: 24,
            height: 24,
            canScale: true, // for Android
            enableZoomControls: false // for Android
        });
        row.add(logo);
        if (StatusNet.Platform.isAndroid()) {
            StatusNet.AvatarCache.lookupAvatar(acct.siteLogo, function(path) {
                logo.image = path;
            });
        } else {
            // https://appcelerator.lighthouseapp.com/projects/32238-titanium-mobile/tickets/1680-ios-regression-imageview-loaded-from-local-file-no-longer-scales-in-current-git-build
            logo.image = acct.siteLogo;
        }
    }

    var label = Titanium.UI.createLabel({
        text: title,
        left: 80,
        top: 0,
        bottom: 0,
        right: 0,
        font: {
            fontWeight: acct.is_default ? 'bold' : 'normal',
            fontSize: 18
        },
        minimumFontSize: 8
    });
    row.add(label);

    if (StatusNet.Platform.isAndroid()) {
        var that = this;

        // There's no native tableview editing system on Android.
        // Set up a long-click handler to give a delete option.
        StatusNet.Platform.setupLongClick(row, function() {
            var dialog = Titanium.UI.createOptionDialog({
                destructive: 0,
                cancel: 1,
                options: ['Delete account', 'Cancel'],
                title: title + ' options'
            });
            dialog.addEventListener('click', function(event) {
                if (event.index == 0) {
                    StatusNet.debug('Attempting to delete account: ' + acct.username + '@' + acct.getHost());
                    that.deleteAccountRow(acct);
                    that.showAccounts();
                    //that.client.switchPPTAccount();
                    that.showingLongclickDialog = false;
                } else {
                    StatusNet.debug('Account delete canceled.');
                }
            });
            that.showingLongclickDialog = true;
            dialog.show();
        });
    }

    this.rows.push(row);
    StatusNet.debug('show account row done.');
};

/**
 * Do some extra UI cleanup after removing an account row, and
 * show add account screen if all the rows have been removed.
 */
StatusNet.SettingsView.prototype.deleteAccountRow = function(account) {
    if (account) {
        account.deleteAccount();
        accounts = StatusNet.Account.listAll(StatusNet.getDB());
        if (accounts.length == 0) {
            StatusNet.debug("No accounts left; showing add account panel");
            this.navbar.setRightNavButton(this.edit);
            this.table.editing = false;
            this.showAddAccount(true);
        }
        // Remove the cancel button if any row has been deleted
        // because pushing it could return you to an invalid
        // timeline
        this.navbar.setLeftNavButton(false);
    }
};

/**
 * Validate input and see if we can make it work yet
 */
StatusNet.SettingsView.prototype.verifyAccount = function(onSuccess, onError) {
    var that = this;
    this.discoverNewAccount(function(acct) {
        StatusNet.debug("Discovered... found: " + acct);

        that.workAcct = acct;
        that.fields.status.text = "Testing login...";

        acct.apiGet('account/verify_credentials.xml', function(status, xml) {
            that.fields.status.text = "Login confirmed.";

            that.workAcct.avatar = $(xml).find('user > profile_image_url').text();

            // get site specific configuration info
            that.workAcct.apiGet('statusnet/config.xml', function(status, xml) {
                that.workAcct.textLimit = $(xml).find('site > textlimit').text();
                that.workAcct.siteLogo = $(xml).find('site > logo').text();

                // finally call our success
                onSuccess();

            }, function(status, msg) {
                that.fields.status.text = "No site config; bad server version?";
                StatusNet.debug("Failed to load site config: HTTP response " +
                    status + ": " + msg);
                onError();
            });

        }, function(status, msg) {
            if (status == 401) {
                // Bad auth
                that.fields.status.text = "Bad nickname or password.";
            } else {
                that.fields.status.text = "HTTP error " + status;
            }
            StatusNet.debug("We failed to load account info: HTTP response " +
                status + ": " + msg);
            onError();
        });
    }, function() {
        that.fields.status.text = "Could not verify site.";
        StatusNet.debug("Bogus acct");
        that.workAcct = null;
        onError();
        //$("#new-save").attr("disabled", "disabled");
        //$("#new-avatar").attr("src", "images/default-avatar-stream.png");
    });
};

StatusNet.SettingsView.prototype.checkAccount = function(view, onSuccess) {
    var that = this;
    this.discoverPPTAccount(function(status, responseObj, responseText) {
     	StatusNet.debug("####stevenchen status: " + status);
     	StatusNet.debug("####stevenchen nickname: " + responseObj.nickname);
     	//that.fields.username.value = responseObj.nickname ;
     	view.nickname = responseObj.nickname ;
     	//StatusNet.debug("####stevenchen nickname1: " + that.fields.username.value);
     	onSuccess() ;
   	}, function(status, responseObj, responseText) {
     	StatusNet.debug("####stevenchen status: " + status);
    	StatusNet.debug("####stevenchen responseText: " + responseText);
  	});
};

/**
 * Build an account object from the info in our form, if possible.
 * We won't yet know for sure whether it's valid, however...
 *
 * @param onSuccess function(StatusNet.Account acct)
 * @param onError function()
 */
StatusNet.SettingsView.prototype.discoverPPTAccount = function(onSuccess, onError) {
	
    var username = $.trim(this.fields.username.value);
    var password = this.fields.password.value;
    var site = 'http://p.pengpengtou.com'

    if (username == '' || password == '' || site == '') {
        onError();
        return;
    }
    
    var url = site + '/api/auth.json' ;

    var params = "username=" + username + "&password=" + password ; 
    
    StatusNet.HttpClientPPT.send(url,onSuccess,onError,params) ;
    
};

/**
 * Build an account object from the info in our form, if possible.
 * We won't yet know for sure whether it's valid, however...
 *
 * @param onSuccess function(StatusNet.Account acct)
 * @param onError function()
 */
StatusNet.SettingsView.prototype.discoverNewAccount = function(onSuccess, onError) {
		StatusNet.debug("####stevenchen discoverNewAccount ");
		StatusNet.debug("####stevenchen discoverNewAccount this.nickname:" + this.nickname);
    var username = $.trim(this.nickname);
		StatusNet.debug("####stevenchen username:" + username);
    var password = this.fields.password.value;
    var site = 'a.pengpengtou.com' //$.trim(this.fields.site.value);

    if (username == '' || password == '' || site == '') {
        onError();
        return;
    }

    var that = this;
    var url;

    var foundAPI = function(apiroot) {
        that.fields.status.text = "Found " + apiroot;
        onSuccess(new StatusNet.Account(username, password, apiroot));
    };

    if (site.substr(0, 7) == 'http://' || site.substr(0, 8) == 'https://') {
        url = site;
        if (url.substr(url.length - 4, 4) == '/api') {
            url = url + '/';
        }
        if (url.substr(url.length - 5, 5) == '/api/') {
            // Looks like we've been given an API base URL... use it!
            onSuccess(new StatusNet.Account(username, password, url));
        } else {
            // Not sure what we've got, so try discovery...
            StatusNet.RSD.discover(url, function(rsd) {
                StatusNet.RSD.discoverTwitterApi(rsd, foundAPI, onError);
            }, onError);
        }
    } else if (site == 'twitter.com') {
        // Special case Twitter...
        // but it probably ain't super great as we do SN-specific stuff!
        url = 'https://twitter.com/';
        onSuccess(new StatusNet.Account(username, password, url));
    } else {
        // Looks like a bare hostname. Try its root page as HTTPS and HTTP...
        // Try RSD discovery!
        this.fields.status.text = "Finding secure server...";
        var rsd = 'https://' + site + '/rsd.xml';
        StatusNet.RSD.discoverTwitterApi(rsd, foundAPI, function() {
            that.fields.status.text = "Finding non-secured server...";
            var rsd = 'http://' + site + '/rsd.xml';
            StatusNet.RSD.discoverTwitterApi(rsd, foundAPI, onError);
        });
    }
};

StatusNet.SettingsView.prototype.saveNewAccount = function() {
    var id = this.workAcct.ensure(StatusNet.getDB());
    this.workAcct.id = id;
    StatusNet.debug("Saved new account with id " + id);
};

StatusNet.SettingsView.prototype.open = function() {
    StatusNet.Platform.animatedOpen(this.window, 'down', this.table);
};

StatusNet.SettingsView.prototype.closeWindow = function() {
    this.onClose.notify();
    StatusNet.Platform.animatedClose(this.window, 'down', this.table);
};

StatusNet.SettingsView.prototype.close = function() {
    // Close down shared state; not needed here atm.
};

StatusNet.SettingsView.prototype.getVerifyCode = function() {
    // Close down shared state; not needed here atm.
    
    var username = $.trim(this.fields.username.value);
    var site = 'http://p.pengpengtou.com'

    if (username == '') {
        var errDialog = Titanium.UI.createAlertDialog({
            title: '警告',
            message: '您必须输入手机号码！',
            buttonNames: ['确认']
        });
        errDialog.show();
        return ;
    }
    
    var url = site + '/api/get_verify_code.json' ;

    var params = "mobile=" + username ; 
    
    StatusNet.HttpClientPPT.send(url,function(status, responseObj, responseText){
    	StatusNet.debug("####stevenchen get verify code:" + responseObj.verify_code);
    },function(status, responseObj, responseText){
    	StatusNet.debug("####stevenchen get verify code:" + responseObj.verify_code);
    },params) ;
};

StatusNet.SettingsView.prototype.register = function(view) {
    // Close down shared state; not needed here atm.
    
    var username = $.trim(this.fields.username.value);
    var password = $.trim(this.fields.password.value);
    var verifyCode = $.trim(this.fields.verifyCode.value);
    var site = 'http://p.pengpengtou.com'

    if (username == '') {
        var errDialog = Titanium.UI.createAlertDialog({
            title: '警告',
            message: '您必须输入手机号码！',
            buttonNames: ['确认']
        });
        errDialog.show();
        return ;
    }
    
    if (password == '') {
        var errDialog = Titanium.UI.createAlertDialog({
            title: '警告',
            message: '您必须输入密码！',
            buttonNames: ['确认']
        });
        errDialog.show();
        return ;
    }
    
    if (verifyCode == '') {
        var errDialog = Titanium.UI.createAlertDialog({
            title: '警告',
            message: '您必须输入验证码！',
            buttonNames: ['确认']
        });
        errDialog.show();
        return ;
    }
    
    var url = site + '/api/reg.json' ;

    var params = "mobile=" + username + '&password=' + password + '&pas_verify=' + verifyCode
    
    StatusNet.HttpClientPPT.send(url,function(status, responseObj, responseText){
    	StatusNet.debug("####stevenchen register response:" + responseText);
    	view.nickname = responseObj.nickname ;
    	StatusNet.debug("####stevenchen register this.nickname:" + view.nickname);
    	view.verifyAccount(function() {
        StatusNet.debug('login click: updated');
        if (view.workAcct != null) {
            // @fixme separate the 'update state' and 'login' actions better
            view.saveNewAccount();
            doClose();
        }
     	});
    },function(status, responseObj, responseText){
    	StatusNet.debug("####stevenchen register response:" + responseText);
    },params) ;
};

