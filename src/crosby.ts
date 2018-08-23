/*	CrOSby: a service gateway bridging BIDMC ITS and G Suite Admin
 *	authored by Robert Hurst <rhurst@bidmc.harvard.edu>
 */
import dns = require('dns')
import express = require('express')
import fileUpload = require('express-fileupload')
import https = require('https')
import fs = require('fs')
import readline = require('readline')
import syslog = require('modern-syslog')

//	Google APIs v33
import { GoogleApis } from 'googleapis'
import { GoogleAuth, JWT, OAuth2Client } from 'google-auth-library'
//v29 - no longer required
//import { Admin } from 'googleapis/build/src/apis/admin/directory_v1'
//import * as admin_directory_v1 from 'googleapis/build/src/apis/admin/directory_v1'

interface oauth_clientid {
	installed: {
		client_id: string
		project_id: string
		auth_uri: string
		token_uri: string
		auth_provider_x509_cert_url: string
		client_secret: string
		redirect_uris: string[]
	}
}

// If modifying these scopes, delete any previously saved credentials
// at .credentials/admin-crosby.json
const SCOPES = [
	'https://www.googleapis.com/auth/admin.directory.device.chromeos',
	'https://www.googleapis.com/auth/admin.directory.domain.readonly',
	'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
	'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly'
]
//const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/'
const TOKEN_DIR = './.credentials/'
const TOKEN_PATH = TOKEN_DIR + 'admin-crosby.json'

export let appClientId: oauth_clientid

process.chdir(__dirname)
process.title = 'crosby'
syslog.open(process.title)
syslog.upto(6)	//	LOG_INFO

function who(req): string
{
	let client = req.header('x-forwarded-for') || req.hostname
	let who = '<anonymous>'
	if (req.header('authorization'))
		who = Buffer.from(req.header('authorization').split(' ')[1], 'base64').toString().split(':')[0]
	return `${who}@${client} `
}

// Load client secrets from the downloaded JSON OAuth client ID file:
// https://console.developers.google.com/apis/credentials?project=ccc-classic
try {
	appClientId = JSON.parse(fs.readFileSync(TOKEN_DIR + 'client_secret.json').toString())
}
catch (err) {
	console.log('Error loading client secret file: ', err)
	process.exit()
}

//	service sanity check on startup: return our top domain
const google = new GoogleApis()
const directory = google.admin('directory_v1')
//v29 - no longer required
//const directory = google.admin<Admin>('directory_v1')

authorize(appClientId, (auth) => {
	directory.domains.get({ auth: auth,
		customer: 'my_customer', domainName: 'bidmc.harvard.edu'
		}, (err, response) => {
		if (err) {
			syslog.error('test fetch domain :: ', err)
			return
		}
		console.log(response.status, response.statusText, response.data.domainName)
	})
})

//dns.lookup('localhost', (err, addr, family) => {
dns.lookup('0.0.0.0', (err, addr, family) => {

	const app = express()
	app.set('trust proxy', ['loopback', addr])

	let ssl = {
		key: fs.readFileSync('./keys/localhost.key'), cert: fs.readFileSync('./keys/localhost.crt')
	}
	let server = https.createServer(ssl, app)
	let port = parseInt(process.env.PORT) || 3333
  
	server.listen(port, addr)
	console.log('*'.repeat(80))
	console.log(`Node.js ${process.version} BIDMC ITS CrOSby service`)
	console.log(`startup on ${process.env['HOSTNAME']} (${process.platform}) at ` + new Date())
	console.log(`listening on ${port}`)
	syslog.note(`listening on ${port}`)

	app.use('/crosby', express.static(__dirname + '/static'))
	app.use(fileUpload())

	//	return our entire OU list
	//	GET https://www.googleapis.com/admin/directory/v1/customer/my_customer/orgunits?type=all&key={YOUR_API_KEY}
	app.get('/crosby/ou/', (req, res) => {
		authorize(appClientId, (auth) => {
			directory.orgunits.list({ auth: auth,
				customerId: 'my_customer', type: 'all'
			}, (err, response) => {
				if (err) {
					syslog.error(who(req) + 'fetch ou list :: ', err.message)
					res.status(500).send({message: err.message})
				}
				else {
					syslog.note(who(req) + 'fetch ou list')
					let ou = response.data.organizationUnits
					ou.sort((a, b) => {
						var x = a.orgUnitPath.toLowerCase()
						var y = b.orgUnitPath.toLowerCase()
						if (x < y) { return -1 }
						if (x > y) { return 1 }
						return 0
					})
					let data = ou.map((i) => { return { key:i.orgUnitPath, value:i.orgUnitId.split(':')[1] } })
					res.send(data)
				}
				res.end()
			})
		})
	})

	//	GET https://www.googleapis.com/admin/directory/v1/customer/{customerId}/devices/chromeos/{deviceId}?key={YOUR_API_KEY}
	app.get('/crosby/device/', (req, res) => {
		authorize(appClientId, (auth) => {
			directory.chromeosdevices.get({ auth: auth,
				customerId: 'my_customer', deviceId: req.query.id
			}, (err, response) => {
				if (err) {
					syslog.error(who(req) + 'fetch device :: ', err.message)
					res.status(500).send({message: err.message})
				}
				else {
					syslog.note(who(req) + `fetch device ${req.query.id}`)
					res.send(response.data)
				}
				res.end()
			})
		})
	})

	//	GET https://www.googleapis.com/admin/directory/v1/customer/my_customer/devices/chromeos?orgUnitPath={orgUnitPath}&fields=chromeosdevices(annotatedAssetId%2CannotatedLocation%2CannotatedUser%2CdeviceId%2CethernetMacAddress%2CfirmwareVersion%2ClastEnrollmentTime%2ClastSync%2CmacAddress%2Cmeid%2Cmodel%2Cnotes%2CorgUnitPath%2CosVersion%2CplatformVersion%2CserialNumber%2Cstatus%2CsupportEndDate)&key={YOUR_API_KEY}
	app.get('/crosby/devices/', (req, res) => {
		authorize(appClientId, (auth) => {
			let params = <any>{ auth: auth, customerId: 'my_customer', fields: 'chromeosdevices(annotatedAssetId,annotatedLocation,annotatedUser,deviceId,ethernetMacAddress,firmwareVersion,lastEnrollmentTime,lastSync,macAddress,meid,model,notes,orgUnitPath,osVersion,platformVersion,serialNumber,status,supportEndDate)'
			}
			//	https://support.google.com/chrome/a/answer/1698333
			if (req.query.id) params.query = `id:${req.query.id}`
			if (req.query.asset_id) params.query = `asset_id:${req.query.asset_id}`
			if (req.query.ethernet_mac) params.query = `ethernet_mac:${req.query.ethernet_mac}`
			if (req.query.wifi_mac) params.query = `wifi_mac:${req.query.wifi_mac}`
			directory.chromeosdevices.list(params, (err, response) => {
				if (err) {
					syslog.error(who(req) + `fetch devices ${params.query || 'all'}:: `, err.message)
					res.status(500).send({message: err.message})
				}
				else {
					syslog.note(who(req) + `fetch devices ${params.query || 'all'}`)
					let result = {}
					if (response.data.chromeosdevices) {
						result = params.query ? response.data.chromeosdevices[0] : response.data.chromeosdevices
					}
					res.send(result)
				}
				res.end()
			})
		})
	})

	app.post('/crosby/move', function (req, res) {
		authorize(appClientId, (auth) => {
			console.log(`move device ${req.query.id} to ${req.query.ou}`)
			let deviceIds = { deviceIds: [ req.query.id ] }
			directory.chromeosdevices.moveDevicesToOu({ auth: auth,
				customerId: 'my_customer', orgUnitPath: req.query.ou, requestBody: deviceIds
			}, (err, response) => {
				if (err) {
					syslog.error(who(req) + 'move device :: ', err.message)
					res.status(500).send({message: err.message})
				}
				else {
					syslog.note(who(req) + `move device ${req.query.id} to ${req.query.ou}`)
					res.send(response.data)
				}
				res.end()
			})
		})
	})

	app.post('/crosby/patch', function (req, res) {
		authorize(appClientId, (auth) => {
			let patch = <any>{}
			if (req.query.annotatedAssetId) patch.annotatedAssetId = req.query.annotatedAssetId
			if (req.query.annotatedLocation) patch.annotatedLocation = req.query.annotatedLocation
			if (req.query.annotatedUser) patch.annotatedUser = req.query.annotatedUser
			if (req.query.notes) patch.notes = req.query.notes
			console.log(`patch device ${req.query.id} to ${patch}`)
			directory.chromeosdevices.patch({ auth: auth,
				customerId: 'my_customer', deviceId: req.query.id, requestBody: patch
			}, (err, response) => {
				if (err) {
					syslog.error(who(req) + 'patch device :: ', err.message)
					res.status(500).send({message: err.message})
				}
				else {
					syslog.note(who(req) + `patch device ${req.query.id} to ${patch}`)
					res.send(response.data)
				}
				res.end()
			})
		})
	})

	app.post('/crosby/upload', function (req, res) {
		if (!req.files)
			return res.status(400).send('No file was uploaded')

		let config = <fileUpload.UploadedFile>req.files.file
		console.log(`upload file ${config.name} requested`)
		if (config.name == 'gc-by-ou.json')
			config.mv(process.cwd() + '/static/' + config.name, function(err) {
				if (err)
					return res.status(500).send(err)
				return res.send('file uploaded')
			})
	})

})

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials: oauth_clientid, callback) {
  var clientSecret = credentials.installed.client_secret
  var clientId = credentials.installed.client_id
  var redirectUrl = credentials.installed.redirect_uris[0]
  var auth = new GoogleAuth()
  var oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl)

	// Check if we have previously stored a token.
	let token = ''
	try {
		token = fs.readFileSync(TOKEN_PATH).toString()
	}
	catch (err) {
		getNewToken(oauth2Client, callback)
		return
	}
	oauth2Client.credentials = JSON.parse(token)
	callback(oauth2Client)
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close()
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err)
        return
      }
      oauth2Client.credentials = token
      storeToken(token)
      callback(oauth2Client)
    })
  })
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR)
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err
    }
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
  console.log('Token stored: ', TOKEN_PATH)
}

process.on('SIGHUP', function () {
	console.log(new Date() + ' :: received hangup')
	syslog.warn('hangup')
	process.exit()
})
  
process.on('SIGINT', function () {
	console.log(new Date() + ' :: received interrupt')
	syslog.warn('interrupt')
	process.exit()
})
  
process.on('SIGQUIT', function () {
	console.log(new Date() + ' :: received quit')
	syslog.warn('quit')
	process.exit()
})
  
process.on('SIGTERM', function () {
	console.log(new Date() + ' shutdown')
	syslog.note('terminated')
	process.exit()
})
