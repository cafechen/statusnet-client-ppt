StatusNet.HttpClientPPT = {};

/**
 * Start an asynchronous, web call. If username and password are provided,
 * use HTTP Basic Auth.  If the data argument is supplied the request will
 * be a POST, otherwise it will be a GET. Any needed parameters for GET
 * must be in the url, as part of the path or query string.
 *
 * @param string   url         the URL
 * @param callable onSuccess   callback function called after successful HTTP fetch: function(status, responseXML, responseText)
 * @param callable onError     callback function called if there's an HTTP error: function(status, responseXML, responseText)
 * @param mixed    data        any POST data, as either raw string or dictionary of key-value pairs; values that are blobs will be uploaded as attachments
 * @param String   username    optional username for HTTP Basic Auth
 * @param String   password    optional password for HTTP Basic Auth
 *
 * @fixme XML vs text parameters on callbacks should be sorted out more cleanly
 */
StatusNet.HttpClientPPT.send = function(url, onSuccess, onError, data) {

    StatusNet.debug("in post");

    try {

        var client = Titanium.Network.createHTTPClient();
        client.setTimeout(600000); // 1 min timeout to help with poor connectivity

        client.onload = function() {
        	
        		StatusNet.debug("####ppt webRequest: in onload");

            StatusNet.debug("####ppt webRequest: in onload, before parse " + this.status);

            var responseJson = this.responseText ;
            
            var type = client.getResponseHeader('Content-Type');
            
            StatusNet.debug("####ppt webRequest: in onload, the type: " + type);
            
            StatusNet.debug("####ppt webRequest: in onload, responseJson: " + responseJson);
            
            var responseObj = eval('(' + responseJson + ')');

            StatusNet.debug("####ppt webRequest: after parse, before onSuccess");

            if (this.status == 200) {
                StatusNet.debug("####ppt webRequest: calling onSuccess");
                onSuccess(this.status, responseObj, this.responseText);
                StatusNet.debug("####ppt webRequest: after onSuccess");

            } else {
                StatusNet.debug("####ppt webRequest: calling onError");
                onError(this.status, responseObj, this.responseText);
            }
            StatusNet.debug("####ppt webRequest: done with onload.");
        };

        // @fixme Hack to work around bug in the Titanium Desktop 1.2.1
        // onload will not fire unless there a function assigned to
        // onreadystatechange.
        client.onreadystatechange = function() {
            // NOP
        };

        // XXX: client.onerror is only called by mobile's HTTPClient
        client.onerror = function(e) {
            StatusNet.debug("####ppt webRequest: failure! " + e.error);
            onError(client.status, null, "Error: " + e.error);
        };

        if (data) {
            StatusNet.debug("####ppt HTTP POST to: " + url);
            client.open("POST", url);
        } else {
            StatusNet.debug("####ppt HTTP GET to: " + url);
            client.open("GET", url);
        }

        if (data) {
            StatusNet.debug('####ppt webRequest: sending data: ' + data);
            // Titanium Mobile/iPhone doesn't set Content-Type, which breaks PHP's processing.
            if (typeof data == "string") {
                client.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                //client.setRequestHeader('Content-Type', 'multipart/form');
            }
            client.send(data);
            //client.send(StatusNet.HttpClient.formData(data));
        } else {
            client.send();
        }

    } catch (e) {
        StatusNet.debug('####ppt webRequest: HTTP client exception: ' + e);
        onError('exception', null, e);
    }
};
