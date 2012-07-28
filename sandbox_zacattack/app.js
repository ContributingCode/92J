var async   = require('async');
var express = require('express');
var util    = require('util');
var http = require('http');  

//var jQuery = require('jQuery');


// Example useage of getJSON.  Important for querying Volunteer Match
//jQuery.getJSON('http://twitter.com/status/user_timeline/treason.json?count=10&callback=?',function(data) {
//  console.log(data);
//});

// create an express webserver
var app = express.createServer(
  express.logger(),
  express.static(__dirname + '/public'),
  express.bodyParser(),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({ secret: process.env.SESSION_SECRET || 'secret123' }),
  require('faceplate').middleware({
    app_id:  process.env.FACEBOOK_APP_ID,
    secret:  process.env.FACEBOOK_SECRET,
    scope:  'user_likes,user_photos,user_photo_video_tags'
  })
);

// Connect app to Volunteer Match 
// Stores account information for Volunteer Match
var volunteerMatch = {
  accountName: process.env.VOLUNTEER_MATCH_ACCOUNT,
  accountKey: process.env.VOLUNTEER_MATCH_KEY
};

var name = volunteerMatch.accountName;
var key = volunteerMatch.accountKey;
var path = '/api/call';

// Send request to ask information
function SendRequest(action, query) {
	 if (query.length !=  0) {
	 	 var url = path + '?action=' + action + '&key=' + key
		  + '&query=' + JSON.stringify(query);
	} else {
	 	 var url = path + '?action=' + action + '&key=' + key;
	}		  
	console.log('url:, ' + url);
	var get_options = {
      	     host: 'www.volunteermatch.org',
      	     path: url,
  	 };	     


       var get_req = http.get(get_options, function(res) {
       console.log('STATUS: ' + res.statusCode);	      
       console.log('HEADERS: ' + JSON.stringify(res.headers));      
       res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
	  return chunk;
      	});
      });
     
     // for debugging
      get_req.on('error', function(e) {
      	      console.log("Got error: " + e.message);
	});
      console.log('host :' + get_options.host); 
      return -1;
}

// input the location string
function searchOrganizations(loc) {
	 fd = ["name", "location", "title", "parentOrg", "vmUrl", "imageUrl"];
	 conds = { location : loc,  nbOfResults : 20, pageNumber : 3, fieldsToDisplay : fd };
	 return data = SendRequest('searchOrganizations', conds);
}

function searchOpportunities(loc) {
	 fd = ["name", "location", "title", "parentOrg", "vmUrl", "imageUrl"];
	 conds = { location : loc,  nbOfResults : 20, pageNumber : 3, fieldsToDisplay : fd };
	 return data = SendRequest('searchOpportunities', conds);
}

// Create database instance
if(process.env.VCAP_SERVICES)
{
	var env = JSON.parse(process.env.VCAP_SERVICES);
	var mongo = env['mongodb-1.8'][0]['credentials'];
}
else{
	var mongo = {
		"hostname":"localhost",
		"port":27017,
		"username":"",
		"password":"",
		"name":"",
		"db":"db"
	}
    }

//    var generate_mongo_url = function(obj){
//	obj.hostname = (obj.hostname || 'localhost');
//	obj.port = (obj.port || 27017);
//	obj.db = (obj.db || 'users');
//
//	if(obj.username && obj.password){
//		return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
//	}
//	else{
//		return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
//	}
//    }
//
//var mongourl = generate_mongo_url(mongo);
//
    	var params = {
		host: mongo.hostname,
		port: mongo.port,
		username: mongo.username,
		password: mongo.password,
		db: mongo.db
	}

//initiate database connection.
var collections = ["users"];
var db = require("mongojs").connect(params, collections);

db.users.ensureIndex({"fb_uid" : 1}, {unique:true}, function(err, log) {
	console.log(err);
	console.log(log);
});

db.users.ensureIndex({"links" : 1}, function(err, log) {
	console.log('Error: ' + err);
	console.log('log: ' + log);
});

// listen to the PORT given to us in the environment
var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var http = require('http');

app.listen(port, function() {
  console.log("Listening on " + port);
});

app.dynamicHelpers({
  'host': function(req, res) {
    return req.headers['host'];
  },
  'scheme': function(req, res) {
    return req.headers['x-forwarded-proto'] || 'http';
  },
  'url': function(req, res) {
    return function(path) {
      return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(req, res)(path);
    }
  },
  'url_no_scheme': function(req, res) {
    return function(path) {
      return '://' + app.dynamicViewHelpers.host(req, res) + (path || '');
    }
  },
});

function render_page(req, res) {
  req.facebook.app(function(app) {
    req.facebook.me(function(user) {
      res.render('index.ejs', {
        layout:    false,
        req:       req,
        app:       app,
        user:      user
      });
    });
  });
}

var url = 'http://www.facebook.com';


function spit_details(req,res) {
	console.log('ID  = ' + req.params.id);
	//Check if logged in..
	//if(req.facebook.token) {
		//Give me your details..
		//req.facebook.get('/me', function(me) {
			//Searching if you exist..
			var id = req.params.id;
			db.users.find({'fb_uid': id}, function(err, result) {
				if(err) {
					//Somethings broken
					console.log('error: ' + err);
				} else if(result.length == 0) {
					//Couldn't find ...hmmm must add you
					console.log('Record not found' + result);
					db.users.save({'fb_uid' : id, 'links': ['http://fb.com']}, function(err,log) {
						console.log('Callback');
						var body = 'You are new, but dont worry everybody here was once new but now its their home coz you never leave ...Hotel California';
						res.writeHead(200, {
							  'Content-Length': body.length,
							    'Content-Type': 'text/plain' });
						res.end(body);
					});
				} else { console.log("Found, " + JSON.stringify(result));
					//Found .. here are your embarrasing details
					var url = 'http://reddit.com/r/funny'
					db.users.update({'fb_uid': id}, 
							{$set: {'fb_uid': id}, $push: {'links': url}}, 
							true, 
							function(err,log) {
								console.log("Callback");
								var body = JSON.stringify(result);
//								res.writeHead(200, {
//									'Content-Length': body.length,
//							    		'Content-Type': 'text/plain' });
								res.send(result);
//								res.end(body);
							});
				}
	  		});
		//});
	//}
}

function init_details(userid, return_value) {
	console.log('ID  = ' + userid);
	//Check if logged in..
	//if(req.facebook.token) {
		//Give me your details..
		//req.facebook.get('/me', function(me) {
			//Searching if you exist..
			var id = userid;
			db.users.find({'fb_uid': id}, function(err, result) {
				if(err) {
					//Somethings broken
					console.log('error: ' + err);
				} else if(result.length == 0) {
					//Couldn't find ...hmmm must add you
					console.log('Record not found' + result);
					db.users.save({'fb_uid' : id, 'links': ['http://fb.com']}, function(err,log) {
						console.log('Callback');
//						var body = 'You are new, but dont worry everybody here was once new but now its their home coz you never leave ...Hotel California';
//						res.writeHead(200, {
//							  'Content-Length': body.length,
//							    'Content-Type': 'text/plain' });
//						res.end(body);
						return_value = log
					});
				} else { console.log("Found, " + JSON.stringify(result));
					//Found .. here are your embarrasing details
					var url = 'http://reddit.com/r/funny'
					db.users.update({'fb_uid': id}, 
							{$set: {'fb_uid': id}, $push: {'links': url}}, 
							true, 
							function(err,log) {
								console.log("Callback");
								var body = JSON.stringify(result);
//								res.writeHead(200, {
//									'Content-Length': body.length,
//							    		'Content-Type': 'text/plain' });
//								res.send(result);
//								res.end(body);
								return_value = result;
							});
				}
	  		});
		//});
	//}
}

function handle_facebook_request(req, res) {
 
  // if the user is logged in
  if (req.facebook.token) {

  req.facebook.get('/me', function(me) {
 	db.users.save({"fb_uid" : me.id});
	console.log(me.id);
    });
    async.parallel([
      function(cb) {
        // query 4 friends and send them to the socket for this socket id
        req.facebook.get('/me/friends', { limit: 4 }, function(friends) {
          req.friends = friends;
          cb();
        });
      },
      function(cb) {
        // query 16 photos and send them to the socket for this socket id
        req.facebook.get('/me/photos', { limit: 16 }, function(photos) {
          req.photos = photos;
          cb();
        });
      },
      function(cb) {
        // query 4 likes and send them to the socket for this socket id
        req.facebook.get('/me/likes', { limit: 4 }, function(likes) {
          req.likes = likes;
          cb();
        });
      },
      function(cb) {
        // use fql to get a list of my friends that are using this app
        req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function(result) {
          req.friends_using_app = result;
          cb();
        });
      }
    ], function() {
      render_page(req, res);
    });

  } else {
    render_page(req, res);
  }
}

app.get('/', handle_facebook_request);
app.post('/', handle_facebook_request);

app.get('/details/:id', spit_details);
app.post('/details/:id', spit_details);

