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

/**
 * Constructor for UI manager class for the client.
 *
 * @param StatusNet.Account _account
 * @return StatusNet.Client object
 */
StatusNet.Client = function(_account) {

    StatusNet.debug("Client constructor");

    if (_account) {
        StatusNet.debug("we have an account");
        
        
    } else {
        StatusNet.debug("we don't have an account");
    }

    this.account = _account;
    this.infoview = null ;
    this.webViewReady = false;
    this.infoNavbar = null ;
    this.indexNavbar = null ;
    this.newNoticeView = null;
    this.accountView = null;
    this.isRefreshing = false; // Are we doing pull-to-refresh or load more?
    this.init();
		
		this.sent = new StatusNet.Event();
    this.onClose = new StatusNet.Event();
    this.currTabName = null ;
   	this.currAccount = null ;
};

StatusNet.Client.prototype.getActiveAccount = function() {
    return this.account;
};

StatusNet.Client.prototype.getActiveTimeline = function() {
    return this.timeline;
};

StatusNet.Client.prototype.getActiveView = function() {
    return this.view;
};

StatusNet.Client.prototype.getServer = function() {
    return this.account.apiroot.substr(0, this.account.apiroot.length - 4); // hack for now
};

/**
 * Reload timeline notices
 */
StatusNet.Client.prototype.refresh = function() {
    var that = this;
    this.isRefreshing = true;
    this.timeline.update(function(cnt) {
        Titanium.App.fireEvent('StatusNet_timelineFinishedUpdate', {
            count: cnt
        });
    });
};

/**
 * General initialization stuff
 */
StatusNet.Client.prototype.init = function() {
	
		if(this.infoview != null){
			this.infoview.visible = false ;
		}
	
    StatusNet.debug("Client init");
    var client = this;

    this.loadedSound = Titanium.Media.createSound({
        url: "sounds/load.wav"
    });

    // Set this up early -- need it before the main window is created.
    Ti.App.addEventListener('StatusNet_switchAccount', function(event) {
        StatusNet.debug('Switching accounts! ... Account id = ' + event.id);
        // Using an event so we can trigger from another heavyweight window

        client.initAccountView(StatusNet.Account.getById(event.id));
    });
    StatusNet.debug("StatusNet.Client.prototype.init - Checking for account...");
    if (!this.account) {
        StatusNet.debug("StatusNet.Client.prototype.init - No account, showing accountView");
        this.showSettingsView();
    } else {
        StatusNet.debug("StatusNet.Client.prototype.init - account is set...");

        StatusNet.debug("Client setting up shake event");
        Titanium.Gesture.addEventListener('shake', function(event) {
            StatusNet.debug("Shaken, not stirred.");
            if (client.timeline) {
                StatusNet.debug("Triggering update for shake gesture...");
                client.timeline.update( function() {
                    StatusNet.debug("Updated, gonna show:");
                    //client.view.show();
                    StatusNet.debug("Updated and done showing.");
                });
                StatusNet.debug("Started an update, waiting...");
            }
            StatusNet.debug("Done checking out the shake.");
        });
        // Set up communications between the core code and the
        // timeline view WebView... once it's set up on the
        // receive end, we'll continue.
        this.initAccountView(this.account);
    }
};

/**
 * Set up event listeners for communications from our timeline web views
 */
StatusNet.Client.prototype.initInternalListeners = function() {
    var that = this;

    Ti.App.addEventListener('StatusNet_externalLink', function(event) {
        // Open external links in configured or default browser...
        that.openURL(event.url);
    });
    Ti.App.addEventListener('StatusNet_switchUserTimeline', function(event) {
        that.switchUserTimeline(event.authorId);
    });
    Ti.App.addEventListener('StatusNet_replyToNotice', function(event) {
        //noticeId: noticeId, noticeAuthor: noticeAuthor
        that.newNoticeDialog(event.noticeId, event.noticeAuthor);
    });
    Ti.App.addEventListener('StatusNet_faveNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.faveNotice(event.noticeId);
    });
    Ti.App.addEventListener('StatusNet_unfaveNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.unFaveNotice(event.noticeId);
    });
    Ti.App.addEventListener('StatusNet_repeatNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.repeatNotice(event.noticeId);
    });
    Ti.App.addEventListener('StatusNet_shareNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.shareNotice(event.noticeId);
    });
    Ti.App.addEventListener('StatusNet_forwardNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);
        that.newNoticeDialog(event.noticeId, event.noticeAuthor, event.noticeContent);
    });
    Ti.App.addEventListener('fakefakefake', function() {
    }); // sigh... heisenbug
    Ti.App.addEventListener('StatusNet_deleteNotice', function(event) {
        StatusNet.debug('Event: ' + event.name);

        // Delete dialog looks better on Android with a confirm message,
        // but it looks better on iPhone without one

        if (StatusNet.Platform.isAndroid()) {
            that.getActiveView().showConfirmDialog('您确认要删除么?', function() {
                that.deleteNotice(event.noticeId);
            }, null, '是', '否');
        } else {
            that.getActiveView().showConfirmDialog(null, function() {
                that.deleteNotice(event.noticeId);
            }, null, '删除', '返回');
        }
    });
    Ti.App.addEventListener('StatusNet_tabSelected', function(event) {
        StatusNet.debug('Event: ' + event.tabName);
        that.currTabName = event.tabName ;
   			that.currAccount = event.tabName ;
        that.setAccountLabel(event.tabName);
        that.switchView(event.tabName);
    });
    Ti.App.addEventListener('StatusNet_tabSelectedUser', function(event) {
        StatusNet.debug('Event: ' + event.tabName);
        if(that.indexview){
         	that.mainwin.remove(that.indexview);
         	that.indexview = null;	
        }
        that.currTabName = event.tabName ;
   			that.currAccount = event.index ;
   		that.setNavbarVisiable();
        that.setAccountLabel(event.tabName + "新鲜事");
        that.switchView(event.index);
    });
    Ti.App.addEventListener('StatusNet_tabSelectedInfo', function(event) {
        StatusNet.debug('Event: ' + event.tabName);
        that.currTabName = event.tabName ;
   			that.currAccount = event.tabName ;
        that.setAccountLabel(event.tabName);
        that.switchViewInfo(event.tabName);
    });
    Ti.App.addEventListener('StatusNet_tabSelectedIndex', function(event) {
        StatusNet.debug('Event: ' + event.tabName);
        that.currTabName = event.tabName ;
   			that.currAccount = event.tabName ;
        that.setAccountLabel(event.tabName);
        that.switchViewIndex(event.tabName);
    });
    Ti.App.addEventListener('StatusNet_subscribe', function(event) {
        StatusNet.debug('Event: ' + event);
        that.subscribe(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_subscribeComplete', {
                user: event.userId
            });
        });
    });
    Ti.App.addEventListener('StatusNet_unsubscribe', function(event) {
        StatusNet.debug('Event: ' + event);
        that.unsubscribe(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_unsubscribeComplete', {
                user: event.userId
            });
        });
    });
    Ti.App.addEventListener('StatusNet_block', function(event) {
        StatusNet.debug('Event: ' + event);
        that.block(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_blockComplete', {
                user: event.userId
            });
        });
    });
    Ti.App.addEventListener('StatusNet_unblock', function(event) {
        StatusNet.debug('Event: ' + event);
        that.unblock(event.userId, function() {
            Titanium.App.fireEvent('StatusNet_unblockComplete', {
                user: event.userId
            });
        });
    });
    Ti.App.addEventListener('StatusNet_sendDirectMessage', function(event) {
        StatusNet.debug('Event: ' + event);
        that.directMessageDialog(event.recipient);
    });
    Ti.App.addEventListener('StatusNet_timelineRefresh', function(event) {
        StatusNet.debug('Event: ' + event);
        // Don't show the regular spinner if the pull-to-refresh spinner is running
        if (!event.showSpinner) {
            that.isRefreshing = true;
        }
        that.timeline.update(function() {
            if (that.loadedSound) {
                that.loadedSound.play();
            }
            Titanium.App.fireEvent('StatusNet_timelineFinishedUpdate', {
                gar: "gar"
            });
        });
    });
    Ti.App.addEventListener('StatusNet_indexRefresh', function(event) {
        StatusNet.debug('Event: ' + event);
        // Don't show the regular spinner if the pull-to-refresh spinner is running
        if (!event.showSpinner) {
            that.isRefreshing = true;
        }
        that.switchViewIndex('index') ;
    });
    Ti.App.addEventListener('StatusNet_timelineLoadMore', function(event) {
        StatusNet.debug('Event: ' + event);
        StatusNet.debug("Got request for older notices from webview, retrieving...");
        // Don't show the regular spinner if the pull-to-refresh spinner is running
       	if(that.isRefreshing){
        	if (that.loadedSound) {
         		that.loadedSound.play();
        	}
       	}else{
		    	that.isRefreshing = true;
		      that.timeline.update(function(cnt) {
		          if (that.loadedSound) {
		              that.loadedSound.play();
		          }
		          Titanium.App.fireEvent('StatusNet_timelineFinishedUpdate', {
		              count: cnt
		          });
		      },
		      that.timeline.getOlderNoticesUrl()
		      );
       	}
    });
    Ti.App.addEventListener('StatusNet_timelineFinishedUpdate', function(event) {
        StatusNet.debug('statusnet_client  StatusNet_timelineFinishedUpdate.....');
        //that.toolbar.isLoading = false;
    });
    Ti.App.addEventListener('StatusNet_viewAttachImage', function(event) {
        StatusNet.debug('statusnet_client  StatusNet_viewAttachImage..... '+event.imgSrc);
        
        that.initAttachViewer(event.imgSrc);
    });
    Ti.App.addEventListener('StatusNet_showChooseHeadDialog', function(event) {
        StatusNet.debug('statusnet_client  StatusNet_showChooseHeadDialog..... authorId');
        // that.initAttachViewer(event.imgSrc);
      	that.showChooseHeadDialog();
    });
    Titanium.Gesture.addEventListener('orientationchange', function(event) {
        Titanium.App.fireEvent('StatusNet_orientationChange', {
            orientation: event.orientation
        });
    });
};

/**
 * Switch the view to a specified timeline
 *
 * @param String timeline   the timeline to show
 */
StatusNet.Client.prototype.switchView = function(view) {

    StatusNet.debug("StatusNet.Client.prototype.switchView - view = " + view);
    
  	if(this.infoview != null){
			this.infoview.visible = false ;
		}
		
		if(this.infoNavbar != null){
			this.infoNavbar.view.hide() ;
			this.infoNavbar._label.hide() ;
		}
		
		if(this.indexview != null){
			this.indexview.visible = false ;
		}
		
		if(this.indexNavbar != null){
			this.indexNavbar.view.hide() ;
			this.indexNavbar._label.hide() ;
		}

    if (this.account) {
        StatusNet.debug("we still have an account");
    } else {
        StatusNet.debug('we lost our account somehow');
    }

    if (view == "developer") {
        // Special-case developer tools!
        this.showDeveloperTools();
        return;
    }

    if (this.view) {
        // Tell the current view to stop trying to access the web view.
        // If it's still loading things in the background, this'll keep
        // them from stomping over the next-selected view.
        //
        // Parsed notices should still get saved into the cache though,
        // at the lower level.
        this.view.close();
    }

    var that = this;

    switch (view) {

        case 'public':
            this.timeline = new StatusNet.TimelinePublic(this);
            this.view = new StatusNet.TimelineViewPublic(this);
            break;
        case 'user':
            this.switchUserTimeline();
            return;
        case "friends":
            this.timeline = new StatusNet.TimelineFriends(this);
            this.view = new StatusNet.TimelineViewFriends(this);
            break;
        case 'mentions':
            this.timeline = new StatusNet.TimelineMentions(this);
            this.view = new StatusNet.TimelineViewMentions(this);
            break;
        case 'favorites':
            this.timeline = new StatusNet.TimelineFavorites(this);
            this.view = new StatusNet.TimelineViewFavorites(this);
            break;
        case 'inbox':
            this.timeline = new StatusNet.TimelineInbox(this);
            this.view = new StatusNet.TimelineViewInbox(this);
            break;
        case 'allgroups':
            this.timeline = new StatusNet.TimelineAllGroups(this);
            StatusNet.debug("finished making allgroups timeline");
            this.view = new StatusNet.TimelineViewAllGroups(this);
            StatusNet.debug("finished making allgroups view");
            break;
        case 'search':
            this.timeline = new StatusNet.TimelineSearch(this);
            this.view = new StatusNet.TimelineViewSearch(this);
            break;
       	case 'info':
            //this.timeline = new StatusNet.TimelineSearch(this);
            //this.view = new StatusNet.TimelineViewSearch(this);
           	break ;
       	case 'index':
            //this.timeline = new StatusNet.TimelineSearch(this);
            //this.view = new StatusNet.TimelineViewSearch(this);
           	break ;
        default:
        		if(!isNaN(view)){
        			this.switchUserTimeline(view);
        			return;
        		}else{
            	throw "Gah wrong timeline " + view;
            }
    }

    StatusNet.debug("Initializing view...");
    this.view.init();

    StatusNet.debug('telling the view to show...');
    this.view.show();

    this.view.showSpinner();

    StatusNet.debug('Telling timeline to update:');

    // attach listener for notceAdded
    this.timeline.noticeAdded.attach(function(args) {
        if (args.notify) {
            that.view.notifyNewNotice(args.notice);
        } else {
            StatusNet.debug("noticeAdded event with no args!");
        }
    }, false);

    this.timeline.update(function(cnt) {
        Titanium.App.fireEvent('StatusNet_timelineFinishedUpdate', {
            count: cnt
        });
    });
    StatusNet.debug('timeline updated.');
};

StatusNet.Client.prototype.switchViewInfo = function(view) {

    var that = this;
    
    if(this.infoNavbar != null){
			this.infoNavbar.view.show() ;
			this.infoNavbar._label.show() ;
		}else{
			this.infoNavbar = StatusNet.Platform.createNavBar(this.mainwin, "新闻");
		}
    
    if(that.infoview == null){
	    that.infoview = Titanium.UI.createWebView({
	      top: that.navbar.height,
	      left: 0,
	      right: 0,
	      bottom: 0, //this.toolbar.height,
	      scalesPageToFit: false,
	      url: "http://a.pengpengtou.com/info.html",
	      backgroundColor: 'white'
	    });
    }else{
    	that.infoview.visible = true ;
    }
    
    that.mainwin.add(that.infoview);
    
    StatusNet.debug('timeline updated.');
};

StatusNet.Client.prototype.switchViewIndex = function(view) {
	var that = this;
	StatusNet.HttpClientPPT.getHTML("http://p.pengpengtou.com/info/index/userid/" + this.account.username,function(status, responseText){
  	StatusNet.debug("####response :" + responseText + ":" + status);
  	Titanium.App.fireEvent('StatusNet_indexFinishedUpdate', {
            view: view
        });
        if (that.loadedSound) {
                that.loadedSound.play();
            }
  	var html = responseText ;
  	that.showViewIndex(html)
  },function (){
  	
  },null)
};

StatusNet.Client.prototype.showViewIndex = function(html) {
    var that = this;
    
    var loadingViewHeight = 45;
    that.setIndexLoading(loadingViewHeight);
    if(this.indexNavbar != null){
			this.indexNavbar.view.show() ;
			this.indexNavbar._label.show() ;
		}else{
			this.indexNavbar = StatusNet.Platform.createNavBar(this.mainwin, "福将碰碰头");
		}
		
		var updateButton = Titanium.UI.createButton({
    	width: 40,
    	height: 40,
     	top: 2
    });
    if (StatusNet.Platform.isApple()) {
     	// iPhone has a nice system icon we can use here...
    	updateButton.systemButton = Titanium.UI.iPhone.SystemButton.COMPOSE;
    } else {
        // @fixme check for 240dpi version
      updateButton.backgroundImage = 'images/new_button.png';
      //updateButton.backgroundSelectedImage = 'images/new_button-on.png';
      var glowy = new StatusNet.Glowy(this.indexNavbar.view, updateButton);
      // backgroundSelectedImage seems to be broken by our touch handlers
      // for the glowy effect, so let's add more to fake it. :D
      updateButton.addEventListener('touchstart', function() {
          updateButton.backgroundImage = 'images/new_button-on.png';
      });
      updateButton.addEventListener('touchend', function() {
          updateButton.backgroundImage = 'images/new_button.png';
      });
      updateButton.addEventListener('touchcancel', function() {
          updateButton.backgroundImage = 'images/new_button.png';
      });
    }

    updateButton.addEventListener('click', function() {
   		that.newNoticeDialog();
    });
    
  	this.indexNavbar.setLeftNavButton(updateButton);
        
    var logoutButton = Titanium.UI.createButton({
        width: 70,
        top: 0,
        bottom: 0,
        title: "登出"
    });
    
    logoutButton.addEventListener('click', function() {
        StatusNet.debug("logout click......");
        StatusNet.debug('showSettings!');
        that.account.deleteAccount();
        that.showSettingsView();
    });
    
    this.indexNavbar.setRightNavButton(logoutButton);
    if(that.indexview == null){
	    that.indexview = Titanium.UI.createWebView({
	      top: that.navbar.height + loadingViewHeight,
	      left: 0,
	      right: 0,
	      bottom: 0,
	      loading:true,
	      showScrollbars:true, 
          scalesPageToFit: false,
	      //html: "http://p.pengpengtou.com/info/index/userid/" + this.account.username,
	      html: html,
	      //url: "index.html",
	      backgroundColor: 'white'
	    });
	    that.mainwin.add(that.indexview);
    }else{
        if (StatusNet.Platform.isApple()) {
            StatusNet.debug('that.indexview.setHtml(html)...');
            that.indexview.setHtml(html);
        }else{
	        StatusNet.debug('that.indexview.remove webview...');
	        that.mainwin.remove(that.indexview);
	        that.indexview = Titanium.UI.createWebView({
	          top: that.navbar.height + loadingViewHeight,
	          left: 0,
	          right: 0,
	          bottom: 0,
	          loading:true,
	          showScrollbars:true, 
	          scalesPageToFit: false,
	          //html: "http://p.pengpengtou.com/info/index/userid/" + this.account.username,
	          html: html,
	          //url: "index.html",
	          backgroundColor: 'white'
	        });
	        StatusNet.debug('timeline updated.');
	        that.mainwin.add(that.indexview);
        }
    	//that.indexview.visible = true ;
    	//that.indexview.setHtml(html);
    }    
    that.showIndexLoading(loadingViewHeight);
    //StatusNet.debug('timeline updated.');
    //that.mainwin.add(that.indexview);
};
StatusNet.Client.prototype.setIndexLoading = function(loadingViewHeight) {
	var that = this;
	if(that.loadingView){
		return true;
	}	
	that.loadingView = Titanium.UI.createView({
    	zIndex : 0,
    	top : that.navbar.height,
    	visible:true,
    	width : '100%',
    	height : loadingViewHeight || 45,
    	backgroundColor:'#fff'
    });
    var loadingInfo = Titanium.UI.createLabel({
    	font : {
				fontSize : '20sp',
				fontFamily : 'Arial',
				fontWeight:'bold'
		},
		color : '#000',
		left:'40%',
    	width : '30%',
    	height : that.loadingView.height,
    	text : '加载中...',
    	textAlign : 'center'
    });
    var loadingImg = Titanium.UI.createImageView({
    	left:'30%',
    	width : parseFloat(that.loadingView.height)*8/15 + 'dp',
    	height : that.loadingView.height,
		image:'images/iscroll-loader.gif'
    });
    that.loadingView.add(loadingInfo);  
    that.loadingView.add(loadingImg); 
    that.mainwin.add(that.loadingView);   
}

StatusNet.Client.prototype.showIndexLoading = function(loadingViewHeight){
	var that = this;
	that.setIndexLoading(loadingViewHeight || 45);
    that.indexview.addEventListener('load',function(e){
    	var animation = Ti.UI.createAnimation({top:-150, duration:800});
		var animationIndex = Ti.UI.createAnimation({top:that.navbar.height, duration:300});
		that.indexview.animate(animationIndex);
		if(that.loadingView){
			that.loadingView.animate(animation);
		}
    	animation.addEventListener('complete',function(e){
    		that.mainwin.remove(that.loadingView);
    		that.loadingView = null;
		});		
	});
}

StatusNet.Client.prototype.switchUserTimeline = function(id) {

    StatusNet.debug("in switchUserTimeline - user id = " + id);

    if (id) {
        StatusNet.debug("user id: " + id);
        timeline = 'user' + '-' + id;
        this.timeline = new StatusNet.TimelineUser(this, id);
    } else {
        StatusNet.debug("id is undefined");
        this.timeline = new StatusNet.TimelineUser(this);
    }

    this.view = new StatusNet.TimelineViewUser(this);
    this.view.init();
    this.view.clearTimelineView();

    var that = this;

    this.timeline.update( function() {
        that.view.showHeader();
    },
    false
    );
};

StatusNet.Client.prototype.setMainWindowTitle = function(title) {
    this.mainwin.title = title;
};

StatusNet.Client.prototype.switchAccount = function(acct) {
    Ti.App.fireEvent('StatusNet_switchAccount', {
        "id": acct.id
    });
};

StatusNet.Client.prototype.switchPPTAccount = function() {
		StatusNet.debug('####ppt switchPPTAccount...');
		var accounts = StatusNet.Account.listAll(StatusNet.getDB());
		StatusNet.debug('####ppt switchPPTAccount length:' + accounts.length);
		var acct = accounts[0];
    Ti.App.fireEvent('StatusNet_switchAccount', {
        "id": acct.id
    });
};

StatusNet.Client.prototype.initAttachViewer = function(url){
    StatusNet.debug('initAccountView entered... url:'+url);
    
    var view = this;
    var window = this.lwindow = Titanium.UI.createWindow({
        title: "企业微博",
        backgroundColor: StatusNet.Platform.dialogBackground(),
        navBarHidden: true // hack for iphone for now
    });

    // @fixme drop the duped title if we can figure out why it doesn't come through
    // var navbar = StatusNet.Platform.createNavBar(window, '图片查看');

    var cancel = this.cancelButton = Titanium.UI.createButton({
        title: "返回",
        width:70,
        heigth:40,
        opacity:0.7,
        left:5,
        top:5
    });
    cancel.addEventListener('click', function() {
        StatusNet.Platform.animatedClose(window);
    });
    
    //navbar.setLeftNavButton(cancel);
    
    var imageWidth = Math.min(Titanium.Platform.displayCaps.platformWidth,
                          Titanium.Platform.displayCaps.platformHeight);
    var imageHeight = Math.max(Titanium.Platform.displayCaps.platformWidth,
                          Titanium.Platform.displayCaps.platformHeight);
    
    // var image = Ti.UI.createImageView({
        // width:imageWidth,
        // image:url,
        // enableZoomControls:true,
        // touchEnabled:true,
        // canScale:true
    // });
    // window.add(image);
    
    var webview = Titanium.UI.createWebView({
        url:url,
        width:imageWidth,
        enableZoomControls:true,
        backgroundColor:'black',
        scalesPageToFit:true
    });
    window.add(webview);
    
    window.add(cancel);
    
    StatusNet.Platform.animatedOpen(window);
}

StatusNet.Client.prototype.initAccountView = function(acct) {
    
    StatusNet.debug('initAccountView entered...');

    this.account = acct;

    var that = this;

    if (!this.mainwin) {
        // Set up global event listeners, which we'll need to talk to
        // the other contexts for the timeline and with the tabbed bar.
        this.initInternalListeners();

        this.mainwin = Titanium.UI.createWindow({
            backgroundColor: 'black',
            navBarHidden: true,
            exitOnClose: true // for Android back button
        });

        this.navbar = StatusNet.Platform.createNavBar(this.mainwin);

        var selfLabel = this.selfLabel = Titanium.UI.createLabel({
            left: 110,
            right: 60,
            top: 0,
            bottom: 0,
            visible: false,
            color: "white",
            font: {
                fontSize: 18
            },
            minimumFontSize: 8 // This has no effect on Android; we have a hack in setAccountLabel below.
        });
        
        selfLabel.addEventListener('click', function() {
        	StatusNet.HttpClientPPT.send("http://p.pengpengtou.com/api/user_select/userid/" + that.account.username, function(status,reponseObj,responseText) {
			   		StatusNet.debug('###ppt reponseObj:' + reponseObj.length) ;
			   		var picker = new StatusNet.Picker({
		      	});
			   		for(var i = 0; i < reponseObj.length; i++){
			   			picker.add(reponseObj[i]['name'] + '新鲜事', function(_index){
			   				var user = reponseObj[_index] ;
			   				that.currTabName = user['name'] ;
   							that.currAccount = user['id'] ;
		        		that.setAccountLabel(user['name'] + '新鲜事');
		        		that.switchView(user['id']) ;
		       		});
			   		};
		       	picker.add('返回', function() {
		        	//Titanium.UI.Clipboard.setText(text);
		       	});
		        //picker.addCancel();
		        picker.show();
		    },function(){
		    	
		    },null)});

				this.currTabName = 'index' ;
        this.setAccountLabel('index');
        this.navbar.view.add(selfLabel);

        var updateButton = this.updateButton = Titanium.UI.createButton({
            width: 40,
            height: 40,
            visible: false,
            top: 2
        });
        if (StatusNet.Platform.isApple()) {
            // iPhone has a nice system icon we can use here...
            updateButton.systemButton = Titanium.UI.iPhone.SystemButton.COMPOSE;
        } else {
            // @fixme check for 240dpi version
            updateButton.backgroundImage = 'images/new_button.png';
            //updateButton.backgroundSelectedImage = 'images/new_button-on.png';
            var glowy = new StatusNet.Glowy(this.navbar.view, updateButton);

            // backgroundSelectedImage seems to be broken by our touch handlers
            // for the glowy effect, so let's add more to fake it. :D
            updateButton.addEventListener('touchstart', function() {
                updateButton.backgroundImage = 'images/new_button-on.png';
            });
            updateButton.addEventListener('touchend', function() {
                updateButton.backgroundImage = 'images/new_button.png';
            });
            updateButton.addEventListener('touchcancel', function() {
                updateButton.backgroundImage = 'images/new_button.png';
            });
        }

        updateButton.addEventListener('click', function() {
            that.newNoticeDialog();
        });
        // this.navbar.setRightNavButton(updateButton);
        
        var backButton = this.backButton = Titanium.UI.createButton({
            width: 70,
            top: 0,
            visible: false,
            bottom: 0,
            title: "返回"
        });
        
        backButton.addEventListener('click', function() {
            that.switchViewIndex('index') ;
        });
        
        this.navbar.setLeftNavButton(backButton);
        
        this.actInd = Titanium.UI.createActivityIndicator();
    		this.actInd.message = '发送中...';
    		this.mainwin.add(this.actInd) ;
    		this.actInd.hide() ;

        var tabinfo = {
            
            'friends': {
                deselectedImage: 'images/tabs/new/friends.png',
                selectedImage: 'images/tabs/new/friends_on.png',
                name: 'friends'
            },
            'info': {
                deselectedImage: 'images/tabs/new/info.png',
                selectedImage: 'images/tabs/new/info_on.png',
                name: 'info'
            },
            'index': {
                deselectedImage: 'images/tabs/new/info.png',
                selectedImage: 'images/tabs/new/info_on.png',
                name: 'index'
            }
            // 'search': {deselectedImage: 'images/tabs/new/search.png', selectedImage: 'images/tabs/new/search_on.png', name: 'search'}
        };
        if (Ti.Platform.model == "Simulator") {
            // Some developer goodies when running in iPhone simulator. :)
            tabinfo.developer = {
                deselectedImage: null,
                selectedImage: null,
                name: "developer"
            };
        }

        //this.toolbar = StatusNet.createTabbedBar(tabinfo, this.mainwin, 0);

        this.webview = Titanium.UI.createWebView({
            top: that.navbar.height,
            left: 0,
            right: 0,
            bottom: 0, //this.toolbar.height,
            scalesPageToFit: false,
            url: "timeline.html",
            backgroundColor: 'white'
        });
        this.mainwin.add(this.webview);

        // Prep a listener for when the webview has loaded, so we know it's
        // safe to start work...
        this.webViewReady = false;
        var onReady = function() {
            if (!that.webViewReady) {
                that.webViewReady = true;
                StatusNet.debug('initAccountView triggering timeline setup...');
                that.switchViewIndex('index');
            }
        };
        Titanium.App.addEventListener('StatusNet_timelineReady', onReady);

        // Threading hack...
        // Putting this event listener on the window ensures we run this on the
        // main window's thread, rather than on the new-posting view's thread
        // which dies before we finish loading stuff.
        this.mainwin.addEventListener('StatusNet_refreshAfterPosting', function(event) {
            /*
            StatusNet.debug('gonna re-load');
            that.view.showHeader();
            that.view.showSpinner();
            that.timeline.update(function(cnt) {
                that.view.hideSpinner();
                Titanium.App.fireEvent('StatusNet_timelineFinishedUpdate', {
                    count: cnt
                });
            });
            */
            StatusNet.debug('ALL DONE waiting');
            that.setAccountLabel('index');
            //that.toolbar.highlightTab(1);
            that.switchViewIndex('index');
        });
        this.mainwin.open();
        StatusNet.debug('initAccountView delaying to wait for timeline...');
    } else {
        this.setAccountLabel('index');
        //this.toolbar.highlightTab(0);
        this.switchViewIndex('index');
        StatusNet.debug('initAccountView DONE!');
    }

};

StatusNet.Client.prototype.setAccountLabel = function(name) {
    
    // 修改主界面   显示我的新鲜事、我的分享
    switch (name) {

        case 'user':
            this.selfLabel.text = "我的新鲜事";
            break;
        case "friends":
            this.selfLabel.text = "上级新鲜事";
            break;
       	case "info":
            this.selfLabel.text = "新闻";
            break;
       	case "index":
            this.selfLabel.text = "福将碰碰头";
        case "boss":
        		this.selfLabel.text = "战报新鲜事";
            break;
        default:
            //throw "Gah wrong timeline";
            this.selfLabel.text = name;
     }
    
     this.selfLabel.font = {
         fontSize: 20
     };
};

StatusNet.Client.prototype.setNavbarVisiable = function() {
    
     this.selfLabel.setVisible(true);
     this.updateButton.setVisible(true);
     this.backButton.setVisible(true);
};

/**
 * Show notice input dialog
 */
StatusNet.Client.prototype.newNoticeDialog = function(replyToId, replyToUsername, initialText) {
    if (!this.newNoticeView) {
        var view = this.newNoticeView = new StatusNet.NewNoticeView({
            replyToId: replyToId,
            replyToUsername: replyToUsername,
            initialText: initialText
        });
        var that = this;
        view.sent.attach(function() {
            // Note: using the fireEvent so we run from the proper thread
            // instead of dying after the dialog closes on Android.
            // @fixme load just the posted message, and prepend it
            StatusNet.debug('Firing StatusNet_refreshAfterPosting');
            that.mainwin.fireEvent('StatusNet_refreshAfterPosting');
            StatusNet.debug('Fired StatusNet_refreshAfterPosting');
        });
        view.onClose.attach(function() {
            that.newNoticeView = null;
        });
        view.init();
    }
};

/**
 * Show a dialog for sending a direct msg
 */
StatusNet.Client.prototype.directMessageDialog = function(recipient, onSuccess, onFailure) {
    if (!this.newDirectMessageView) {

        var newDirectMessageView = new StatusNet.directMessageView({
            account: this.account,
            recipient: recipient
        });

        var that = this;
        newDirectMessageView.sent.attach( function(args) {
            StatusNet.Infobar.flashMessage(args.msg);
            that.newDirectMessageView = null;
        });
        newDirectMessageView.init();
    }
};

/**
 * Delete a notice from the timeline
 *
 * @param int noticeId  the ID of the notice to delete
 */
StatusNet.Client.prototype.deleteNotice = function(noticeId) {

    var method = 'statuses/destroy/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.deleteNotice() - deleting notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, response) {
        that.view.hideSpinner();
        StatusNet.debug("Deleted notice " + noticeId);
        //StatusNet.Infobar.flashMessage("Deleted notice " + noticeId);
        StatusNet.Infobar.flashMessage("删除成功！");
        Titanium.App.fireEvent('StatusNet_deleteNoticeComplete', {
            noticeId: noticeId
        });
        that.timeline.decacheNotice(noticeId);
    }, function(status, response) {
        that.view.hideSpinner();
        var msg = $(response).find('error').text();
        if (msg) {
            StatusNet.debug("Error deleting notice " + noticeId + " - " + msg);
            alert("Error deleting notice " + noticeId + " - " + msg);
        } else {
            StatusNet.debug("Error deleting notice " + noticeId + " - " + status + " - " + response);
            alert("Error deleting notice: " + status + " - " + response);
        }
    }
    );
};

/**
 * Favorite a notice
 *
 * Change the class on the notice's fave link from notice_fave to
 * notice_unfave and refresh the notice entry in the cache so it has
 * the right state
 *
 * @param int noticeId  the ID of the notice to delete
 *
 */
StatusNet.Client.prototype.faveNotice = function(noticeId) {
    var method = 'favorites/create/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.faveNotice() - faving notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, response) {
        StatusNet.debug("Faved notice" + noticeId);
        Titanium.App.fireEvent('StatusNet_faveNoticeComplete', {
            noticeId: noticeId
        });
        that.timeline.refreshNotice(noticeId);
        that.view.hideSpinner();
    }, function(status, response) {
        // @fixme notify the timeline to update its view
        that.view.hideSpinner();
        var msg = $(response).find('error').text();
        if (msg) {
            StatusNet.debug("Error favoriting notice " + noticeId + " - " + msg);
            alert("Error favoriting notice " + noticeId + " - " + msg);
        } else {
            StatusNet.debug("Error favoriting notice " + noticeId + " - " + status + " - " + response);
            alert("Error favoriting notice " + noticeId + " - " + status + " - " + response);
        }
    }
    );
};

/**
 * Unfavorite a notice
 *
 * Change the class on the notice's unfave link from notice_unfave
 * to notice_fave and refresh the notice entry in the cache so it has
 * the right state.
 *
 * @param int noticeId  the ID of the notice to delete
 *
 */
StatusNet.Client.prototype.unFaveNotice = function(noticeId) {
    var method = 'favorites/destroy/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.unFaveNotice() - unfaving notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, response) {
        StatusNet.debug("Unfaved notice " + noticeId);
        Titanium.App.fireEvent('StatusNet_unFaveNoticeComplete', {
            noticeId: noticeId
        });
        that.timeline.refreshNotice(noticeId);
        that.view.hideSpinner();
    }, function(status, response) {
        that.view.hideSpinner();
        var msg = $(response).find('error').text();
        if (msg) {
            StatusNet.debug("Error unfavoriting notice " + noticeId + " - " + msg);
            alert("Error unfavoriting notice " + noticeId + " - " + msg);
        } else {
            StatusNet.debug("Error unfavoriting notice " + noticeId + " - " + status + " - " + $(response).text());
            alert("Error unfavoriting notice " + noticeId + " - " + status + " - " + $(response).text());
        }
    }
    );
};

/**
 * Repeat a notice
 *
 * @param int noticeId  the ID of the notice to delete
 *
 * On success, removes the repeat link and refreshes the notice entry
 * in the cache so it has the right state.
 */
StatusNet.Client.prototype.repeatNotice = function(noticeId, linkDom) {
    var method = 'statuses/retweet/' + noticeId + '.xml';

    StatusNet.debug("StatusNet.Client.repeatNotice() - repeating notice " + noticeId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, response) {
        // @fixme load just the posted message, and prepend it
        StatusNet.debug("Repeated notice " + noticeId);
        that.timeline.refreshNotice(noticeId);
        that.timeline.update(function(cnt) {
            Titanium.App.fireEvent('StatusNet_timelineFinishedUpdate', {
                count: cnt
            });
            that.view.hideSpinner();
        });
    }, function(status, response) {
        that.view.hideSpinner();
        var msg = $(response).find('error').text();
        if (msg) {
            StatusNet.debug("Error repeating notice " + noticeId + " - " + msg);
            alert.flashMessage("Error repeating notice " + noticeId + " - " + msg);
        } else {
            StatusNet.debug("Error repeating notice " + noticeId + " - " + status + " - " + response);
            alert.flashMessage("Error repeating notice " + noticeId + " - " + status + " - " + response);
        }
    }
    );
};

/**
 * Repeat a notice
 *
 * @param int noticeId  the ID of the notice to delete
 *
 * On success, removes the repeat link and refreshes the notice entry
 * in the cache so it has the right state.
 */
StatusNet.Client.prototype.shareNotice = function(noticeId) {
    var notice = this.timeline.getNotice(noticeId);

    var msg = $('<div>' + notice.content + '</div>').text();
    var text = 'RT @' + notice.author + ' ' + msg;

    if (StatusNet.Platform.isAndroid()) {
        var send = Ti.Android.createIntent({
            action: Ti.Android.ACTION_SEND,
            type: 'text/plain'
        });
        send.putExtra(Ti.Android.EXTRA_TEXT, text);
        var chooser = Ti.Android.createIntentChooser(send, "Share");
        Ti.Android.currentActivity.startActivity(chooser);
    } else if (StatusNet.Platform.isApple()) {
        var encText = encodeURIComponent(text);
        var picker = new StatusNet.Picker({
            title: "Share"
        });
        if (typeof Titanium.UI.Clipboard != 'undefined') {
            picker.add('Copy', function() {
                Titanium.UI.Clipboard.setText(text);
            });
        }
        picker.add('Mail', function() {
            var dialog = Ti.UI.createEmailDialog({
                messageBody: text
            });
            dialog.open();
        });
        picker.add('Seesmic', function() {
            Ti.Platform.openURL('x-seesmic://update?status=' + encText);
        });
        picker.add('Twitter', function() {
            Ti.Platform.openURL('tweetie:///post?message=' + encText);
        });
        picker.addCancel();
        picker.show();
    }
};

/**
 * Subscribe to a profile
 *
 * @param int profileId  the ID of the profile to subscribe to
 *
 * On success changes the link to an unsubscribe link
 */
StatusNet.Client.prototype.subscribe = function(profileId, onSuccess) {

    StatusNet.debug("StatusNet.Client.prototype.subscribe - user id " + profileId);

    var method = 'friendships/create/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.subscribe() - subscribing to " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, response) {
        that.view.hideSpinner();
        StatusNet.debug("Subscribed to profile " + profileId);
        StatusNet.Infobar.flashMessage("Subscribed to profile " + profileId);
        if (onSuccess) {
            onSuccess();
        }
    }, function(method, response) {
        that.view.hideSpinner();
        var msg = $(response).find('error').text();
        if (msg) {
            StatusNet.debug("Error subscribing to profile " + profileId + " - " + msg);
            StatusNet.Infobar.flashMessage("Error subscribing to profile " + profileId + " - " + msg);
        } else {
            StatusNet.debug("Error subscribing to profile " + profileId + " - " + status + " - " + response);
            StatusNet.Infobar.flashMessage("Error subscribing to profile " + profileId + " - " + status + " - " + response);
        }
    }
    );

};

/**
 * Unsubscribe from a profile
 *
 * @param int profileId  the ID of the profile to unsubscribe from
 *
 * On success changes the link to a subscribe link
 *
 */
StatusNet.Client.prototype.unsubscribe = function(profileId, onSuccess) {
    StatusNet.debug("StatusNet.Client.prototype.unsubscribe - user id " + profileId);

    var method = 'friendships/destroy/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.unsubscribe() - unsubscribing from " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;

    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, data) {
        that.view.hideSpinner();
        StatusNet.debug("Unsubscribed from profile " + profileId);
        StatusNet.Infobar.flashMessage("Unsubscribed from profile " + profileId);
        if (onSuccess) {
            onSuccess();
        }
    }, function(status, responseText) {
        that.view.hideSpinner();
        var msg = $(responseText).find('error').text();
        if (msg) {
            StatusNet.debug("Error unsubscribing from profile " + profileId + " - " + msg);
            StatusNet.Infobar.flashMessage("Error unsubscribing from profile " + profileId + " - " + msg);
        } else {
            StatusNet.debug("Error unsubscribing from profile " + profileId + " - " + status + " - " + responseText);
            StatusNet.Infobar.flashMessage("Error unsubscribing from profile " + profileId + " - " + status + " - " + responseText);
        }
    }
    );
};

/**
 * Block to a profile
 *
 * @param int profileId  the ID of the profile to block
 *
 * On success changes the link to an unblock link
 */
StatusNet.Client.prototype.block = function(profileId, onSuccess) {
    var method = 'blocks/create/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.block() - blocking " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;
    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, response) {
        that.view.hideSpinner();
        StatusNet.debug("Blocked profile " + profileId);
        StatusNet.Infobar.flashMessage("Blocked profile " + profileId);
        if (onSuccess) {
            onSuccess();
        }
    }, function(status, response) {
        that.view.hideSpinner();
        if (msg) {
            StatusNet.debug("Error blocking profile " + profileId + " - " + msg);
            StatusNet.Infobar.flashMessage("Error blocking profile " + profileId + " - " + msg);
        } else {
            StatusNet.debug("Error blocking profile " + profileId + " - " + response);
            StatusNet.Infobar.flashMessage("Error blocking profile " + profileId + " - " + response);
        }
    }
    );
};

/**
 * Unblock to a profile
 *
 * @param int profileId  the ID of the profile to unblock
 *
 * On success changes the link to an unblock link
 */
StatusNet.Client.prototype.unblock = function(profileId, onSuccess) {
    var method = 'blocks/destroy/' + profileId + '.xml';

    StatusNet.debug("StatusNet.Client.block() - unblocking " + profileId);

    var params = "gar=gar"; // XXX: we have to pass something to get web client to work

    var that = this;
    this.view.showSpinner();

    this.account.apiPost(method, params, function(status, response) {
        that.view.hideSpinner();
        StatusNet.debug("Unblocked profile " + profileId);
        StatusNet.Infobar.flashMessage("Unblocked profile " + profileId);
        if (onSuccess) {
            onSuccess();
        }
    }, function(status, response) {
        that.view.hideSpinner();
        $(linkDom).removeAttr('disabled');
        if (msg) {
            StatusNet.debug("Error unblocking profile " + profileId + " - " + msg);
            StatusNet.Infobar.flashMessage("Error unblocking profile " + profileId + " - " + msg);
        } else {
            StatusNet.debug("Error unblocking profile " + profileId + " - " + response);
            StatusNet.Infobar.flashMessage("Error unblocking profile " + profileId + " - " + response);
        }
    }
    );
};

StatusNet.Client.prototype.showSettingsView = function() {

    var that = this;

    function init() {
        var view = that.accountView = new StatusNet.SettingsView(that);
        view.onClose.attach(function() {
            that.accountView = null;
        });
        view.init();
    }

    // The app seems to get confused occassionally or get behind when switching
    // timelines and accounts real fast. This seems to help
    if (!this.accountView) {
        init();
    } else {
        StatusNet.debug("QQQQQ Oh no, we have a zombie accountView, trying headshot...");
        this.accountView = null;
        init();
    }

};

StatusNet.Client.prototype.openURL = function(url) {
    if (StatusNet.Platform.isApple()) {
        // @fixme have a config for this -- some will prefer use of Safari
        // or a custom browser, which would require tweaking the URL.
        var browser = new StatusNet.Browser(this);
        browser.init(url);
        return;
    }
    Titanium.Platform.openURL(url);
};

StatusNet.Client.prototype.showDeveloperTools = function() {
    var that = this;
    var dialog = new StatusNet.Picker({
        title: "Developer goodies"
    });
    dialog.add('Blank timeline', function() {
        that.selfAvatar.image = null;
        that.selfLabel.text = '';
        //that.toolbar.highlightTab(-1);
        that.view.clearTimelineView();
    });
    dialog.addCancel();
    dialog.show();
};

StatusNet.Client.prototype.showChooseHeadDialog = function()
{
    Titanium.API.debug('showChooseHeadDialog entered...');
    var that = this;

        var options = [];
        var callbacks = [];
        var destructive = -1;

            if (StatusNet.Platform.hasCamera()) {
                options.push('拍照');
                callbacks.push(function() {
                    that.copenAttachment('camera', function() {
                        //that.focus();
                    });
                });
            }

            options.push('图片');
            callbacks.push(function() {
                that.copenAttachment('gallery', function() {
                    //that.focus();
                });
            });

        var cancel = options.length;
        options.push('返回');
        callbacks.push(function() {
            // that.focus();
        });

        var dialog = Titanium.UI.createOptionDialog({
            title: '附件',
            options: options,
            cancel: cancel
        });
        if (destructive > -1) {
            dialog.destructive = destructive;
        }
        dialog.addEventListener('click', function(event) {
            if (event.index !== undefined && callbacks[event.index] !== undefined) {
                callbacks[event.index]();
            }
        });
        dialog.show();
};

StatusNet.Client.prototype.copenAttachment = function(source, callback)
{
    StatusNet.debug("QQQQQQ openAttachment");
    if (StatusNet.Platform.isAndroid()) {
        if (!Ti.Filesystem.isExternalStoragePresent) {
            alert('SD card is missing or unmounted. Check card and try again.');
            return;
        }
    }
    var that = this;
    StatusNet.debug("QQQQQQ Getting attachment - source is: " + source);
    that.cgetPhoto(source, function(event) {
        // that.event = event;
        StatusNet.debug('callback entered!');
        if (event.status == 'success') {
            StatusNet.debug('Photo attachment ok!');
            StatusNet.debug('width:' + event.width+" height:"+event.height);
            that.caddAttachment(event);
        } else if (event.status == 'cancel') {
            StatusNet.debug('Photo attachment canceled.');
        } else if (event.status == 'error') {
            StatusNet.debug('Photo attachment failed: ' + event.msg);
            alert('Photo fetch failed: ' + event.msg);
        } else {
            StatusNet.debug('Got unexpected event from photo helper.');
        }
        callback(event);
    });
};

StatusNet.Client.prototype.cgetPhoto = function(source, callback) {
    StatusNet.debug('getPhoto entered!');
    var options = {
        success: function(event) {
            StatusNet.debug('success......');
            callback({
                status: 'success',
                media: event.media,
                height: event.height,
                width: event.width
            });
        },
        cancel: function(event) {
            callback({
                status: 'cancel'
            });
        },
        error: function(event) {
            callback({
                status: 'error',
                media: event.msg
            });
        },
        autohide: true,
        animated: true
    };

    if (source == 'camera') {
        trigger = Titanium.Media.showCamera(options);
    } else if (source == 'gallery') {
        Titanium.Media.openPhotoGallery(options);
    } else {
        Titanium.API.error("Unrecognized camera source. wtf!");
        alert("Bad photo source event. This is a bug!");
    }
};

StatusNet.Client.prototype.caddAttachment = function(event) {
    var media = event.media;
    var size = (StatusNet.Platform.isApple() ? media.size : media.length);
    StatusNet.debug('SIZE IS: ' + size) ;
    
    var width = (media.width) ? media.width : event.width;
    var height = (media.height) ? media.height : event.height;

    var maxSide = 800;
    var out = this.resizePhoto(media, width, height, maxSide);
    media = out.media;
    width = out.width;
    height = out.height;

		size = (StatusNet.Platform.isApple() ? media.size : media.length);
    StatusNet.debug('SIZE IS: ' + size);
    StatusNet.debug('####ppt media:' + media.mimeType);
    
    this.postAvatar(media) ;
   
};

StatusNet.Client.prototype.resizePhoto = function(media, width, height, max) {
    StatusNet.debug("Source image is " + width + "x" + height);

    var orig = {media: media, width: width, height: height};
    // if (StatusNet.Platform.isAndroid()) {
        // // Our resizing gimmick doesn't 100% work on Android yet.
        // // We end up with a PNG, and/or a spew of error messages
        // // about failed type conversions.
        // //
        // // Note that on iPhone we resize ok, but we have no way to
        // // specify the JPEG quality level and end up with a larger
        // // file than necessary.
        // return orig;
    // }

    var targetWidth = 96 ;
    var targetHeight = 96 ;
    
    /*
    if (width > height) {
        if (width > max) {
            targetWidth = max;
            targetHeight = Math.round(height * max / width);
        } else {
            return orig;
        }
    } else {
        if (height > max) {
            targetHeight = max;
            targetWidth = Math.round(width * max / height);
        } else {
            return orig;
        }
    }*/

    StatusNet.debug("Resizing image from " + width + "x" + height +
                    " to " + targetWidth + "x" + targetHeight);
    // Resize through an intermediary imageView
    StatusNet.debug("QQQQQQQQQQQ 0" + targetWidth + " " + targetHeight);
    
    var imageView = Titanium.UI.createImageView({
        width: targetWidth,
        height: targetHeight,
        image: media
    });
    StatusNet.debug("QQQQQQQQQQQ A");

    // Ye horrible hack!
    // on Android, the image conversion esplodes.
    // Try inserting it so it's live...
    // if (StatusNet.Platform.isAndroid()) {
        // this.window.add(imageView);
    // }
    StatusNet.debug("QQQQQQQQQQQ B");
    var converted = imageView.toImage();
    StatusNet.debug("QQQQQQQQQQQ C");
    // if (StatusNet.Platform.isAndroid()) {
        // this.window.remove(imageView);
    // }

    // Then to add insult to injury, on Android it doesn't give us
    // a TiBlob directly, but rather an event object similar to when
    // we fetch directly from the camera. Yeah, doesn't make sense
    // to me either.
    StatusNet.debug("QQQQQQQQQQQ D");
    if (typeof converted.media == "object") {
        StatusNet.debug("QQQQQQQQQQQ E1");
        return {
            media: converted.media,
            width: converted.width,
            height: converted.height
        };
    } else {
        StatusNet.debug("QQQQQQQQQQQ E2 " + converted.width + " " + converted.height);
        return {
            media: converted,
            width: converted.width,
            height: converted.height
        };
    }
};

StatusNet.Client.prototype.postAvatar = function(media)
{
    StatusNet.debug("StatusNet.postAvatar()");
    if (Titanium.Network.online == false) {
        alert("No internet connection!");
        return;
    }

    var that = this;
    var method = 'account/update_profile_image.as';
    var params = {source: StatusNet.Platform.defaultSourceName(),
                  media: media,image: media,user: this.account.username};

    that.enableControls(false);
    that.actInd.show();

    this.account.apiPost(method, params,
        function(status, response) {
        	StatusNet.debug("####ppt postAvatar success");
        	that.actInd.hide();
        	that.enableControls(true);
          Titanium.App.fireEvent('StatusNet_tabSelectedUser', {
   					tabName: that.currTabName,
   					index: that.currAccount
          });
        },
        function(status, response, responseText) {
        	StatusNet.debug("####ppt postAvatar failure");
        	that.actInd.hide();
        	that.enableControls(true);
        	Titanium.App.fireEvent('StatusNet_tabSelectedUser', {
   					tabName: that.currTabName,
   					index: that.currAccount
          });
       	}
    );
};

StatusNet.Client.prototype.enableControls = function(enabled)
{
		this.backButton.enabled = enabled;
    this.updateButton.enabled = enabled;
};
