/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const superagent = require('superagent');
const url = require('url')

exports.martha_v1 = (req, res) => {
  //allow browser to request this from broad sites
  if(req.headers && req.headers.hasOwnProperty('origin')) {
    res.setHeader('Access-Control-Allow-Origin', ["https://firecloud-fiab.dsde-dev.broadinstitute.org:22443"]);
    res.setHeader('Access-Control-Allow-Methods', ["POST", "GET"]);
    console.log("set res header");
  }
  console.log(req.body);
  var body_string = JSON.stringify(req.body);
  console.log(`body_string: ${body_string}`);
  var parsed_body = JSON.parse(body_string);
  console.log(`parsed_body: ${parsed_body}`);
  var orig_url = parsed_body['url'];
  console.log(`orig url: ${orig_url}`);
  console.log(`req.body.url ${req.body.url}`);
  console.log(`req.body['url']: ${req.body['url']}`);
  console.log(`parsed_body['url']: ${parsed_body['url']}`);
  var parsed_url = url.parse(orig_url);
  var orig_path = parsed_url.path;
  var new_path = '/api/ga4gh/dos/v1/dataobjects' + orig_path;
  parsed_url.protocol = 'https';
  parsed_url.path = new_path;
  parsed_url.pathname = new_path;
  var http_url = url.format(parsed_url);
  superagent.get(http_url)
      .end(function(err, response) {
        if(err){
          console.error(err);
          res.status(502).send(err);
          return;
        };
        try {
          var parsedData = JSON.parse(response.text);
        } catch(e) {
          // console.error(e);
          res.status(400).send(`Data returned not in correct format`);
          return;
        };
        var allData = parsedData["data_object"];
        if (!allData) {
          res.status(400).send(`No data received from ${req.body.url}`);
        } else {
          var urls = allData["urls"];
          var pattern = (req.body.pattern);
          if (!pattern) {
            res.status(400).send(`No pattern param specified`);
            return;
          }
          for (var url in urls) {
            var currentUrl = urls[url]["url"];
            if (currentUrl.startsWith(pattern)) {
              var correctUrl = currentUrl;
              res.status(200).send(correctUrl);
            }
          }
          //gone through all urls, no match found
          if (!correctUrl) {
            res.status(404).send(`No ${pattern} link found`);
          }
          ;
        }
        ;
      });
};