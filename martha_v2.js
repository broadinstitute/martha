const helpers = require('./helpers');
const api_adapter = require('./api_adapter');

function parse_request(req) {
    let orig_url = req.body.url;
    if (!orig_url) {
        try {
            orig_url = JSON.parse(req.body.toString()).url;
        } catch (e) {
            console.error(new Error(`Request did not specify a valid url:\n${JSON.stringify(req)}\n${e}`));
        }
    }
    return orig_url;
}

function martha_v2_handler(req, res) {
    let orig_url = parse_request(req);
    if (!orig_url) {
        res.status(400).send('You must specify the URL of a DOS object');
        return;
    }

    let dos_url = helpers.dosToHttps(orig_url);

    console.log(dos_url);

    let dos_promise = api_adapter.resolve_dos(dos_url);
    let bond_promise = api_adapter.talk_to_bond(req.headers.authorization);

    return Promise.all([dos_promise, bond_promise])
        .then((result) => {
            res.status(200).send({'dos': result[0], 'googleServiceAccount': result[1]});
        })
        .catch((err) => {
           console.error(err);
           res.status(502).send(err);
        });
}

exports.martha_v2_handler = martha_v2_handler;