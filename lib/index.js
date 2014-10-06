'use strict';
var Promise = require('bluebird');
var cheerio = require('cheerio');
var json2csv = require('json2csv');
var _ = require('lodash');
var request = require('superagent');

var HOST = 'https://airbnb.com';

// Promisify functions if they haven't been promisified already:
if(!request.Request.prototype.endAsync) {
  Promise.promisifyAll(request.Request.prototype);
}
var json2csvAsync = Promise.promisify(json2csv);

exports = module.exports = airbnbScrape;

/**
 * Takes a `program` instance from the `commander` module and executes the `cli`
 * functionality.
 *
 * @param {Object} program A `program` object from `commander`
 * @return {Promise} A promise to the execution's result
 */

function airbnbScrape(program) {
  var a = new AirbnbScrapper(program || {});

  if(program.args.length === 0) {
    program.outputHelp();
    process.exit(1);
  }

  return a.scrape(program.args);
}

// Main functions and methods:

/**
 * Represents an airbnb.com scrapper. Realizes operations on an array of URLs in
 * order to scrape them and output parsed information.
 *
 * @constructor
 *
 * @param {Object} options
 * @param {Boolean} [options.verbose] If true, will be verbose about operations
 * @param {Boolean} [options.csv] If true, will output information in CSV
 * @param {Boolean} [options.json] If true, will output information in JSON
 */

function AirbnbScrapper(options) {
  this.verbose = options.verbose;
  this.csv = options.csv;
  this.json = options.json;
}

/**
 * Logs a set of messages, if the `airbnbScrapper.verbose` property is true.
 *
 * @param {Mixed} args...
 */

AirbnbScrapper.prototype.log = function(/*args...*/) {
  if(this.verbose) {
    console.log.apply(console, arguments);
  }
};

/**
 * Downloads an Array of URLs, extracts relevant information from their HTML
 * pages and outputs the result.
 *
 * @param {Array.<String>} postings An array of AirBNB posting URLs
 * @return {Promise} A promise to the result
 */

AirbnbScrapper.prototype.scrape = function(postings) {
  return Promise
    .map(postings, this.downloadPosting.bind(this))
    .map(this.extractInfo.bind(this))
    .then(this.outputInfo.bind(this));
};

/**
 * Downloads a resource at some URL and returns a promise to it.
 *
 * @param {String} url The URL to download
 * @return {Promise.<String>} A promise to the resource's "text" (raw HTML,
 * JSON, etc.)
 */

AirbnbScrapper.prototype.downloadPosting = function(url) {
  this.log('Downloading information for posting "' + url + '"...');
  return request
    .get(url)
    .endAsync()
    .then(function(res) {
      return res.text;
    });
};

/**
 * Extracts relevant information from an AirBNB's listing's HTML text.
 *
 * @param {String} html Some AirBNB posting's HTML
 * @return {Object} An object representation of the relevant information for
 * this HTML string
 */

AirbnbScrapper.prototype.extractInfo = function(html) {
  var $ = cheerio.load(html);
  return _.extend({
    title: trim($('#listing_name').text()),
    price_per_night: this.getPrice($),
    host_profile_url: this.getHostUrl($),
  }, this.getDetails($));
};

/**
 * Outputs a set of postings according to stored output options.
 *
 * @param {Array.<Object>} parsed_postings
 */

AirbnbScrapper.prototype.outputInfo = function(parsed_postings) {
  if(this.csv) {
    return this.outputCsv(parsed_postings);
  } else if(this.json) {
    return console.log(JSON.stringify(parsed_postings, null, 2));
  }

  throw new Error('No output format was specified');
};

// Helper functions and methods:
AirbnbScrapper.prototype.outputCsv = function(parsed_postings) {
  this.log('Generating csv...');
  var csvP = json2csvAsync({
    data: parsed_postings,
    fields: getFields(parsed_postings),
  });

  return csvP.then(function(csv) {
    console.log(csv);
  });
};

AirbnbScrapper.prototype.getPrice = function($) {
  var str = $('#dayly_price_string').text();
  if(!str) {
    str = $('#price_amount').text();
  }

  var m = /\$(.+)/.exec(str);
  return m && m[1];
};

AirbnbScrapper.prototype.getHostUrl = function($) {
  var img = $('#host-profile a > img')[0];
  return HOST + img.parent.attribs.href;
};

AirbnbScrapper.prototype.getDetails = function($) {
  return $('#details-column .row > .col-9 > .row > .col-6 > div')
    .map(function(i, el) {
      return trim($(el).text());
    })
    .filter(function(i, text) {
      return !!text;
    })
    .get()
    .reduce(function(ret, text) {
      var s = text.split(':');
      var key = trim(s[0]).toLowerCase().replace(/\s/g, '_');
      ret[key] = trim(s[1]);
      return ret;
    }, {});
};


function trim(str) {
  return str.replace(/(^(\s|\n|\t)+)|((\s|\n|\t)+$)/g, '');
}

function getFields(parsed_postings) {
  var head = _.first(parsed_postings);
  var tail = _.rest(parsed_postings);

  return _.keys(_.reduce(tail, function(memo, posting) {
    _.each(posting, function(value, key) {
      memo[key] = true;
    });

    return memo;
  }, head));
}
