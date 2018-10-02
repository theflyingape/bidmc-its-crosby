loadSiteInfo(site, sites[site], 0, type, (site, displayName) => {
  console.info(site, displayName, 'finishing');
});

function loadSiteInfo(site, siteConfig, nextPageToken, callback) {
  getSiteData(site, siteConfig, nextPageToken)
    .then(siteDetails => {

      if (siteDetails.nextPageToken != 0 && typeof (siteDetails.nextPageToken) !== 'undefined') {
        loadSiteInfo(site, siteConfig, siteDetails.nextPageToken, callback);
      }

      
      if (typeof (siteDetails.nextPageToken) === 'undefined' || siteDetails.nextPageToken === 0) {
        if (typeof (callback) === 'function') {
          callback(site, siteConfig.displayName);
        }
      }
    })
    .catch(reason => {
      if (typeof (callback) === 'function') {
        callback(site, siteConfig.displayName);
      }
      console.error(reason);
    })
}


function getSiteData(site, siteConfig, pageToken) {

  var google = require('googleapis');
  var googleAuth = require('google-auth-library');

  return new Promise((fulfill, reject) => {

    var jwtClient = new google.auth.JWT(
      siteConfig.client_secret.client_email,
      null,
      siteConfig.client_secret.private_key,
      siteConfig.scopes,
      siteConfig.impersonate
    );

    jwtClient.authorize((err, tokens) => {
      if (err) {
        reject('error authenticating ' + siteConfig.displayName);
        return;
      }

      var google_admin = google.admin('directory_v1');

      var options = {};

      if (pageToken === 0) {
        options = {
          'customerId': 'my_customer',
          'auth': jwtClient
        }
      } else {
        options = {
          'customerId': 'my_customer',
          'auth': jwtClient,
          'pageToken': pageToken
        }
      }

      return google_admin.chromeosdevices.list(options, function (err, resp) {
        if( !err ) {
          var newDeviceList = resp != null && typeof resp['chromeosdevices'] !== 'undefined' ? resp['chromeosdevices'] : [];
  
          options.projection = "FULL";
  
          for (var i in newDeviceList) {
            // handle chromeosdevices
          }
  
          fulfill({
            site: site,
            nextPageToken: resp != null && typeof resp['nextPageToken'] !== 'undefined' ? resp['nextPageToken'] : 0,
            items: newDeviceList.length
          }) 

        } else {
          // handle rejection
          reject();
        }

      });

    });

  });
}