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

exports = module.exports = main;

/**
 * Takes a `program` instance from the `commander` module and executes the `cli`
 * functionality.
 *
 * @param {Object} program A `program` object from `commander`
 * @return {Promise} A promise to the execution's result
 */

function main(program) {
  program || (program = { args: [] });
  if(program.args.length === 0) {
    program.outputHelp();
    return process.exit(1);
  }

  return Promise
    .map(program.args, _.partial(exports.downloadPosting, program))
    .map(function(html) {
      return cheerio.load(html);
    })
    .map(exports.extractInfo)
    .then(_.partial(exports.outputInfo, program));
}

/**
 * A helper function to log messages, which is guarded by a guard for
 * `options.verbose` being truthy.
 *
 * @param {Object} options
 * @param {Object} [options.verbose]
 */

exports.log = function log(options/*, args...*/) {
  if(options.verbose) {
    var args = Array.prototype.slice.call(arguments, 1);
    console.log.apply(console, args);
  }
};

/**
 * Downloads a resource at some URL and returns a promise to it.
 *
 * @param {String} url The URL to download
 * @return {Promise.<String>} A promise to the resource's "text" (raw HTML,
 * JSON, etc.)
 */

exports.downloadPosting = function downloadPosting(options, url) {
  exports.log(
    options,
    'Downloading information for posting "' + url + '"...'
  );

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
 * @param {Object} $ Some AirBNB posting's HTML loaded into cheerio
 * @return {Object} An object representation of the relevant information for
 * this HTML string
 */

exports.extractInfo = function extractInfo($) {
  return _.extend({
    title: trim($('#listing_name').text()),
    price_per_night: exports.getPrice($),
    host_profile_url: exports.getHostUrl($),
  }, exports.getDetails($));
};

/**
 * Outputs a set of postings according to stored output options.
 *
 * @param {Array.<Object>} parsed_postings
 * @return {Mixed} A promise to the output's operation or undefined
 */

exports.outputInfo = function outputInfo(options, parsed_postings) {
  if(options.csv) {
    exports.log(options, 'Generating CSV...');
    return exports.outputCsv(parsed_postings);
  } else if(options.json) {
    exports.log(options, 'Generating JSON...');
    return console.log(JSON.stringify(parsed_postings, null, 2));
  }

  throw new Error('No output format was specified');
};

/**
 * Outputs a set of postings as CSV
 *
 * @param {Array.<Object>} parsed_postings
 * @return {Promise} A promise to the output operation
 */

exports.outputCsv = function outputCsv(parsed_postings) {
  var csvP = json2csvAsync({
    data: parsed_postings,
    fields: getFields(parsed_postings),
  });

  return csvP.then(function(csv) {
    console.log(csv);
  });
};

exports.getPrice = function getPrice($) {
  var str = $('#dayly_price_string').text();
  if(!str) {
    str = $('#price_amount').text();
  }

  var m = /\$(.+)/.exec(str);
  return m && m[1];
};

exports.getHostUrl = function getHostUrl($) {
  var img = $('#host-profile a > img')[0];
  return HOST + img.parent.attribs.href;
};

exports.getDetails = function getDetails($) {
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


var trim = exports.trim = function trim(str) {
  return str.replace(/(^(\s|\n|\t)+)|((\s|\n|\t)+$)/g, '');
};

var getFields = exports.getFields = function getFields(parsed_postings) {
  var head = _.first(parsed_postings);
  var tail = _.rest(parsed_postings);

  return _.keys(_.reduce(tail, function(memo, posting) {
    _.each(posting, function(value, key) {
      memo[key] = true;
    });

    return memo;
  }, head));
};
