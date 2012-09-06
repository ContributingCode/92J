var request = require('request');

// Database instance settings
var mongo = {
	"hostnmae": "localhost",
	"port": 27017,
	"username": "",
	"password": "",
	"name": "",
	"db": "db"
}

var params = {
	host: mongo.hostname,
	port: mongo.port,
	username: mongo.username,
	password: mongo.password,
	db: mongo.db
}

// Initiate database connection
var collections = ["cities"];
var db = require("mongojs").connect(params, collections);

var censusDataUrl = 'http://www.census.gov/geo/www/gazetteer/files/Gaz_places_national.txt';

// Create geospatial indexing
db.cities.ensureIndex({ loc : "2d" }, function (err, log) {
  if(err) {
       console.log('Error: ' + err);
  }
  console.log('log: ' + log);	  
});


function insertCities(city)
{
    //TODO: Extract the name of the city (which can span multiple words)
    var offset = 0;
    var cityToInsert = {
	    'USPS': city[0],
	    'GEOID': city[1],
	    'ANSICODE': city[2],
	    'NAME': "",
            'LSAD': city[offset],
	    'FUNCSTAT': city[offset+1],
	    'POP10': city[offset+2],
	    'HU10': city[offset+3],
	    'ALAND': city[offset+4],
	    'AWATER': city[offset+5],
	    'ALAND_SQMI': city[offset+6],
	    'AWATER_SQMI': city[offset+7],
	    'loc': [city[offset+8], city[offset+8]]
    };
}

function getCities(url) {
    request({
        uri: url
    }, function (err, response, body) {
        // Checks if page was found
        if (err && response.statusCode !== 200) {
            console.log('Request error.');
        }
	// Get every line
	var cities = body.split("\n");

	// First line Simply describes the fields, it is not relevant data.  Remove it.
	cities.shift();

	// Insert Each sity into the database.
	cities.forEach(function(city) {
	     insertCity(city[0].match(/[^ ]+/gi));
	});
    });
}

