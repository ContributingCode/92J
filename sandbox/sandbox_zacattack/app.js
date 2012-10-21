var async = require('async');
var express = require('express');
var http = require('http');
var schedule = require('node-schedule');

Array.prototype.diff = function(a) {
    return this.filter(function(i) {return !(a.indexOf(i) > -1);});
};


// Create an express webserver
var app = express.createServer(
express.logger(),
express.static(__dirname + '/public'),
express.bodyParser(),
express.cookieParser(),

// Set this to a secret value to encrypt session cookies
express.session({
    secret: process.env.SESSION_SECRET || 'secret123'
}),
require('faceplate').middleware({
    app_id: process.env.FACEBOOK_APP_ID,
    secret: process.env.FACEBOOK_SECRET,
    scope: 'user_likes,user_photos,user_photo_video_tags'
}));

// Connect app to Volunteer Match 
// Stores account information for Volunteer Match
var volunteerMatch = {
    accountName: process.env.VOLUNTEER_MATCH_ACCOUNT,
    accountKey: process.env.VOLUNTEER_MATCH_KEY
};

// Send request to ask information
function sendRequest(action, query) {
    var path = '/api/call';
    if (query.length != 0) {
        var url = path + '?action=' + action + '&key=' + volunteerMatch.accountKey + '&query=' + JSON.stringify(query);
    } else {
        var url = path + '?action=' + action + '&key=' + volunteerMatch.accountKey;
    }
    console.log('url:, ' + url);
    var get_options = {
        host: 'www.volunteermatch.org',
        path: url,
    };

    var get_req = http.get(get_options, function (res) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        var total = '';
        res.on('data', function (chunk) {
            total += chunk;
            //console.log(chunk);
        });
		console.log("We got here");
        res.on('end', function () {
            var formatted_data = JSON.parse(total);
            var count = 0;
            if (formatted_data.opportunities) {
            	formatted_data.opportunities.forEach(function (opportunity) {
            		if(opportunity.location.geoLocation)
            		{
            			opportunity.loc = [opportunity.location.geoLocation.longitude, opportunity.location.geoLocation.latitude];
            			console.log(opportunity);
            			db.events.insert(opportunity, function(err, result) { console.log(err)});
            		}
            	});
            } else {
                console.log("Sending the formatted_data anyway?");
                console.log("Didn't Get anything");
            }
        });
    });

	
    // for debugging
    get_req.on('error', function (e) {
        //console.log("Got error: " + e.message);
    });
    //console.log('host :' + get_options.host);
    return -1;
}

// input the location string
function searchOrganizations(loc, res) {
    fd = ["location", "title", "parentOrg", "description", "vmUrl", "imageUrl"];
    conds = {
        location: loc,
        radius: "city",
        fieldsToDisplay: fd
    };
    data = sendRequest('searchOrganizations', conds, res);
}

function searchOpportunities(loc) {
    fd = ["location", "title", "parentOrg", "description", "vmUrl", "imageUrl"];
    conds = {
        //location: encodeURIComponent(loc.NAME) + "," + loc.USPS,
        location: "chicago,il",
        radius: "city",
        fieldsToDisplay: fd
    };
    console.log("Sending Request");
    data = sendRequest('searchOpportunities', conds);
}

// Create database instance
if (process.env.VCAP_SERVICES) {
    var env = JSON.parse(process.env.VCAP_SERVICES);
    var mongo = env['mongodb-2.0'][0]['credentials'];
} else {
    var mongo = {
        "hostname": "localhost",
        "port": 27017,
        "username": "",
        "password": "",
        "name": "",
        "db": "db"
    }
}

var params = {
    host: mongo.hostname,
    port: mongo.port,
    username: mongo.username,
    password: mongo.password,
    db: mongo.db
}

//initiate database connection.
var collections = ["users", "cities", "events", "citiesOfInterest", ];
var db = require("mongojs").connect(params, collections);

db.cities.ensureIndex({"loc": "2d"}, function (err, log) { console.log(log) });
db.events.ensureIndex({"loc": "2d"}, function (err, log) { console.log(log) });

//Needs to be done outside of the program, sorry :(
//db.events.ensureIndex({"id":1}, {unique:true}, function(err log) { console.log(log); });

db.users.ensureIndex({
    "fb_uid": 1
}, {
    unique: true
}, function (err, log) {
    console.log(err);
    console.log(log);
});

db.users.ensureIndex({
    "links": 1
}, function (err, log) {
    console.log('Error: ' + err);
    console.log('log: ' + log);
});

// listen to the PORT given to us in the environment
var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var http = require('http');

app.listen(port, function () {
    console.log("Listening on " + port);
});

app.dynamicHelpers({
    'host': function (req, res) {
        return req.headers['host'];
    },
    'scheme': function (req, res) {
        return req.headers['x-forwarded-proto'] || 'http';
    },
    'url': function (req, res) {
        return function (path) {
            return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(req, res)(path);
        }
    },
    'url_no_scheme': function (req, res) {
        return function (path) {
            return '://' + app.dynamicViewHelpers.host(req, res) + (path || '');
        }
    },
});


// Renders Page.  Might want to play around with this a bit.
function render_page(req, res) {
    req.facebook.app(function (app) {
        req.facebook.me(function (user) {
            res.render('index.ejs', {
                layout: false,
                req: req,
                app: app,
                user: user
            });
        });
    });
}

// Database helper functions
function addUser(id) {
    console.log('ID  = ' + id);
    //Searching if you exist..
    db.users.find({
        'fb_uid': id
    }, function (err, result) {
        if (err) {
            //Somethings broken
            console.log('error: ' + err);
        } else if (result.length == 0) {
            //Couldn't find ...hmmm must add you
            console.log('Record not found ' + result);
            db.users.save({
                'fb_uid': id,
                'points': 0
            }, function (err, log) {
                var body = 'You are new, but dont worry everybody here was once new but now its their home coz you never leave ...Hotel California';
                console.log(body);
            });
        }
    });
}



function addCityForCaching(city) {
    //TODO: may not work initially.  Mongojs seems to prefer object defined on the fly
    // as opposed to predefined passed objects (maybe look into passing the JSON
    // as a different object type).

    // Query the city for results and cache the results

    // Add city to list of cities that need to be cached.
    db.citiesOfInterest.save(city, function (err, result) {
        if (err) console.log("ERROR: " + err);
        console.log(result);
    });
}

function favoriteEvent(id, event) {
    db.users.update({
        'fb_uid': id
    }, {
        $addToSet: {
            "favorites": event
        }
    }, function (err, log) {
        if (err) console.log(log);
        else console.log('User: ' + id + ' favorited event: ' + event);
    });
}

function unfavoriteEvent(id, event) {
    db.users.update({
        'fb_uid': id
    }, {
        $pull: {
            "favorites": event
        }
    }, function (err, log) {
        if (err) console.log(log);
        else console.log('User: ' + id + ' unfavorited event: ' + event);
    });
}

function addEventAsAttended(id, event) {
    db.users.update({
        'fb_uid': id
    }, {
        $addToSet: {
            "attended": event
        }
    }, function (err, log) {
        if (err) console.log(log);
        else console.log('User: ' + id + ' attended event: ' + event);
    });
}

function removeUser(id) {
    db.users.remove({
        'fb_uid': id
    }, function (err, log) {
        if (err) console.log(log);
        else console.log('User: ' + id + ' has left the party.');
    });
}

function addPoints(id, points) {
    db.users.update({
        'fb_uid': id
    }, {
        $inc: {
            "points": points
        }
    }, function (err, log) {
        if (err) console.log(log);
        else console.log('User: ' + id + ' earned ' + points + ' points!!');
    });
}

//TODO: Create cacheing functions for storing events.
//Store list of cities (Los Angeles, CA) query each one

var debug_event = {
    location: 'vmware',
    title: 'ContributingCode',
    parentOrg: 'EMC',
    vmURL: 'contributingcode.cloudfoundry.com'
};

function handle_facebook_request(req, res) {
    // if the user is logged in
    if (req.facebook.token) {
        req.facebook.get('/me', function (me) {
            console.log(me.id);
        });
        async.parallel([

        function (cb) {
            // query 4 friends and send them to the socket for this socket id
            req.facebook.get('/me/friends', {
                limit: 4
            }, function (friends) {
                req.friends = friends;
                cb();
            });
        },

        function (cb) {
            // query 16 photos and send them to the socket for this socket id
            req.facebook.get('/me/photos', {
                limit: 16
            }, function (photos) {
                req.photos = photos;
                cb();
            });
        },

        function (cb) {
            // query 4 likes and send them to the socket for this socket id
            req.facebook.get('/me/likes', {
                limit: 4
            }, function (likes) {
                req.likes = likes;
                cb();
            });
        },

        function (cb) {
            // use fql to get a list of my friends that are using this app
            req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function (result) {
                req.friends_using_app = result;
                cb();
            });
        },

        function (cb) {
            req.facebook.get('/me', function (me) {
                addUser(me.id);
                unfavoriteEvent(me.id, debug_event);
                db.users.find({
                    'fb_uid': me.id
                }, function (err, result) {
                    if (err || result.length == 0) {
                        req.user_events = [];
                    } else {
                        console.log(result[0].events);
                        req.user_events = result[0].events;
                    }
                    cb();
                });
            });
        }, ], function () {
            render_page(req, res);
        });

    } else {
        render_page(req, res);
    }
}

// This function is three database calls deep.  So it sucks.  Would probably be faster if this was a sql database, but then
// we'd have extra overhead in other parts of the code.  So win some lose some :P
function searchCachedOpportunities(loc, res) {
    // Check What cities are near the user
    console.log("searchCachedOpportunities");
    db.cities.find({ "loc": { $near: [loc.lon, loc.lat] }}, function (err, result) {
        if (err) {
        	res.send("Database Error");
        	console.log(err);
        }
        else {
            // Match the result against the cached cities database, find what is not there.
			console.log(loc.lon + " " + loc.lat);
			var citiesNear = [];
			result.forEach( function(jsonObject) {
				delete jsonObject._id;
				citiesNear.push(jsonObject);
			});
			
            db.citiesOfInterest.find({}, function (err, result) { // Because I'm in a hurry and I need results!! TODO: MAKE NOT SUCK
				var resultingCities =[];
				console.log(result.length);
				if(result) {
					result.forEach( function(jsonObject) {
						//console.log(jsonObject);
						delete jsonObject._id;
						resultingCities.push(jsonObject);
					});
				}
                //array subtraction
                //console.log(resultingCities);
                //var citiesNotCached = citiesNear.diff(resultingCities);
                
                var citiesNotCached = [];
                var found = 0;
                
                if(resultingCities.length != 0) {
                 
        	        citiesNear.forEach(function(nearCity)  {
            	    	resultingCities.forEach(function(cachedCity)
                		{
        	    			if(nearCity.NAME == cachedCity.NAME && nearCity.USPS == cachedCity.USPS)
        	    				found = 1;
   		             	});
                		if(found == 0)
                		{
            	    		citiesNotCached.push(nearCity)
        	        		//console.log(nearCity);
    	            	}
	                	found = 0;
                	});
            	}
            	else
            		citiesNotCached = citiesNear; //We have cached nothing

                console.log(citiesNotCached);
                if (citiesNotCached.length != 0) //if non-empty
                {
                    // Add the city to our list and recall this function (fuck yeah!)
                    console.log("Woooooot, it's cacheing time!!");
                    db.citiesOfInterest.insert(citiesNotCached, function(err, result) {
                    	if(err)
                    		console.log(err);
                    	else {
                    		cacheCities(citiesNotCached, searchCachedOpportunities(loc, res));
                    	}
                    });
                } else {
                    // Geospatial query with location parameter, use res to fire it back.
                    console.log("HAPPPPPPPPYYYY TIIIMMMEEEE");
                    console.log(loc);
                    db.events.find({
                        "loc": {
                            $near: [loc.lon, loc.lat]
                        }
                    }, function (err, result) {
                        if (err) res.send("Database Error");
                        else res.send(JSON.stringify(result));
                    });
                }
            });
        }
    });
}


function cacheCities(cities, cb)
{
	cities.forEach(function(city) {
		db.citiesOfInterest.insert(city, function(err, result)
		{
			console.log(cities);
			console.log("city inserted");
			searchOpportunities(city);
		});
	});
}

function cacheOpportunities() {
	db.events.drop(function(err, log)
	{
		db.events.ensureIndex({"loc": "2d"}, function (err, log) { 
			db.citiesOfInterest.find( {}, function(err, result)
			{
				cacheCities(result, function() { console.log("Event Refresh Ongoing!"); });
			});
		});
	});
}

// Create caching CRON job. 2:30 a.m. everyday.
var rule = new schedule.RecurrenceRule();
rule.hour = 2;
rule.minute = 30;
var job = schedule.scheduleJob(rule, cacheOpportunities());


// /searchOpportunities?loc
// To make this work comment out var loc
app.get('/:fun/:lon/:lat', function (req, res) {
    if (req.facebook.token) {
        var loc = {
    		 "lon": req.route.params.lon,
        	 "lat": req.route.params.lat
        };
        console.log(loc);
        switch (req.route.params.fun) {
            case 'searchOpportunities':
                searchCachedOpportunities(loc, res);
                break;
            case 'searchOrganizations':
                searchOrganizations(loc, res);
                break;
            case 'checkIn':
            	checkIn(loc, res);
            	break;
            default:
                searchCachedOpportunities(loc, res);
        }
    } else res.send("Access Denied");
});


// Cache Plan:
//      Store all U.S. cities in database
//      When a user queries, get a list of cities that correspond within 100 miles to his location
//      Once done, Add (if they don't exist) to the active cities list.
//            For every new city added, query volunteermatch for more opportunities and add them to the database of opportunities.
//      Do normal greater circle search for user on opportunities.
//      
//      Everynight, perform refresh for opportunities that are contained within the active list.
//
// POSSIBLE ADDITION:
//      If no opportunities are repeatedly returned for a city, blacklist it as inactive and do not attempt to query it. again.

// Whats left?
// check-ins and publishing to facebook and linkedin (lots to do).


//function get_address(url, callback) {
//     request({
//          uri: url
//     }, function (err, response, body) {
//          var window = domino.createWindow();
//          var $ = zepto(window)
//          $('body').append(body);
//          var $videos = $('body').find('.section.details');
//          var s = $($videos[0]).find('address.adr').text();
//          s = s.replace(/(^\s*)|(\s*$)/gi, "");
//          s = s.replace(/[ ]{2,}/gi, " ");
//          s = s.replace(/\n /, "\n");
//          var address = s;
//          console.log(address);
//	  callback(address);
//     });
//}

//function get_address(url, callback) {
//    request({
//        uri: url
//    }, function (err, response, body) {
//        // Checks if page was found
//        if (err && response.statusCode !== 200) {
//            console.log('Request error.');
//        }
//        //Send the body param as the HTML code we will parse in jsdom
//        //also tell jsdom to attach jQuery in the script
//        console.log("jsdom.env prior")
//        jsdom.env({
//            html: body,
//            scripts: ['http://code.jquery.com/jquery-1.6.min.js']
//        }, function (err, window) {
//            //Use jQuery just as in any regular HTML page
//            var $ = window.jQuery,
//                $body = $('body'),
//                $videos = $body.find('.section.details');
//
//            //I will use regular jQuery selectors
//            var s = $($videos[0]).find('address.adr').text();
//            s = s.replace(/(^\s*)|(\s*$)/gi, "");
//            s = s.replace(/[ ]{2,}/gi, " ");
//            s = s.replace(/\n /, "\n");
//            var address = s;
//            console.log(address);
//            callback(address);
//        });
//    });
//}

app.get('/', handle_facebook_request);
app.post('/', handle_facebook_request);