'use strict';
var Promise = require('bluebird');
var cheerio = require('cheerio');
var _ = require('lodash');
var request = require('superagent');

var HOST = 'https://airbnb.com';

if(!request.Request.prototype.endAsync) {
  Promise.promisifyAll(request.Request.prototype);
}

exports = module.exports = airbnbScrapper;

function airbnbScrapper(program) {
  var a = new AirbnbScrapper(program || {});
  return a.scrape(program.args);
}

function AirbnbScrapper(options) {
  this.verbose = options.verbose;
}

AirbnbScrapper.prototype.log = function(/*args...*/) {
  if(this.verbose) {
    console.log.apply(console, arguments);
  }
};

AirbnbScrapper.prototype.scrape = function(postings) {
  return Promise
    .map(postings, this.downloadPosting.bind(this))
    .map(this.extractInfo.bind(this))
    .map(this.outputCsv.bind(this));
};

AirbnbScrapper.prototype.downloadPosting = function(url) {
  this.log('Downloading information for posting "' + url + '"...');
  return request
    .get(url)
    .endAsync()
    .then(function(res) {
      return res.text;
    });
};

AirbnbScrapper.prototype.extractInfo = function(html) {
  var $ = cheerio.load(html);
  return _.extend({
    title: trim($('#listing_name').text()),
    price_per_night: this.getPrice($),
    host_profile_url: this.getHostUrl($),
  }, this.getDetails($));
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

AirbnbScrapper.prototype.outputCsv = function(posting) {
  console.log(posting);
};

function trim(str) {
  return str.replace(/(^(\s|\n|\t)+)|((\s|\n|\t)+$)/g, '');
}
