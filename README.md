# 🏥 BIDMC ITS: CrOSby ☁️

This Node.js express server provides a REST API backend service purposed mainly for the [BIDMC ITS: Who Am I](https://github.com/theflyingape/bidmc-its-whoami) Chrome extension:

* `ou`: retrieve Organization Units in our domain
* `device`: retrieve an enrolled Chrome device 
* `devices`: query for an enrolled Chrome device with either **deviceId**, **serialNumber**, **macAddress**, or **assetId** 
* `move`: place an enrolled Chrome device into another OU
* `patch`: update any of the annotated attributes: **assetId**, **Location**, **User**, **notes**.

## Google Chrome APIs
* [Admin Directory](https://developers.google.com/apis-explorer/?hl=en_US#search/directory/admin/directory_v1/) using [Google APIs client](https://www.npmjs.com/package/googleapis)* for Node.js

[*] watching [issue #1157](https://github.com/google/google-api-nodejs-client/issues/1157)

**Note:** There may be need / opportunity to expand this service gateway to integrate device registration with our standalone Electronic Health Record, [webOMR](https://apps.bidmc.org/webomr_training/), for printing and flag tasks (aka **ZO**).

Apache access into this service is proxy configured to only allow ITS technician access using mod_authnz_pam.
