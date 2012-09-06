var request = require('request');

// Create database instance
var mongo = {
        "hostname": "localhost",
        "port": 27017,
        "username": "",
        "password": "",
        "name": "",
        "db": "cities"
}

var params = {
    host: mongo.hostname,
    port: mongo.port,
    username: mongo.username,
    password: mongo.password,
    db: mongo.db
}

// Initiate database connection.
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

function isNumber(n) {
	  return !isNaN(parseFloat(n)) && isFinite(n);
}

function insertCity(city)
{
    if(!city){
         console.log("End of Input")
	 return;
    }
    var offset = 3;
    var cityName = "";
    while(!(isNumber(city[offset]))){
	    console.log(offset);
            if(!(isNumber(city[offset+1]))){
		    cityName+=city[offset];
	    }
	    offset++;
    }
    offset--;

    db.cities.save({
            'USPS': city[0],
            'GEOID': city[1],
            'ANSICODE': city[2],
            'NAME': cityName,
            'LSAD': city[offset],
            'FUNCSTAT': parseFloat(city[offset+1]),
            'POP10': parseFloat(city[offset+3]),
            'HU10': parseFloat(city[offset+4]),
            'ALAND': parseFloat(city[offset+5]),
            'AWATER': parseFloat(city[offset+6]),
            'ALAND_SQMI': parseFloat(city[offset+7]),
            'AWATER_SQMI': parseFloat(city[offset+8]),
            'loc': [parseFloat(city[offset+9]), parseFloat(city[offset+10])]
    }, function(err, log) {
	    if(err)
               console.log("Error " + err);
	    console.log(log);
    });
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
        console.log("We finished the request");
	// First line Simply describes the fields, it is not relevant data.  Remove it.
	cities.shift();

	// Insert Each city into the database.
	cities.forEach(function(city) {
	     console.log("loop iteration");
	     insertCity(city.match(/[^ ]+/gi));
	});
    });
}

//Go for it!
getCities(censusDataUrl);
