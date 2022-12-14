const UrlModel = require('../models/urlModel.js');
const ShortId = require('shortid');
const ValidUrl = require('valid-url');
const redis = require("redis");
const { promisify } = require("util");


//Connect to redis
const redisClient = redis.createClient(
    18142,    // PORT
    "redis-18142.c301.ap-south-1-1.ec2.cloud.redislabs.com",    // PORT
    { no_ready_check: true }
);
redisClient.auth("yFKsy9HrSmkHjTWznyct5A4RTBTcn1EH", function (err) {    // AUTHENTICATING USER VIA PASSWORD
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");    // SENDING MESSAGE TO CONSOLE FOR SUCCESSFUL CONNECTION OF REDIS
});


//connect to the server

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);       // DEFINING SET FUNCTION OF REDIS
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);       // DEFINING GET FUNCTION OF REDIS

const isValid = function (value) {
    if (typeof value == "undefined" || value == null) return false;
    if (typeof value == "string" && value.trim().length == 0) return false;
    if (typeof value != "string") return false;
    return true;
};

const checkUrl = function (value) {
    let urlRegex = /^(?:(?:(?:https?|http):)?\/\/.*\.(?:png|gif|webp|com|in|org|co|co.in|net|jpeg|jpg))/i;
    if (urlRegex.test(value))
        return true;
}

const createUrl = async (req, res) => {
    try {
        const { longUrl } = req.body;
        const baseUrl = "http://localhost:3000";     //  DEFINING THE PATTERN OF SHORT URL
        if (Object.keys(req.body).length != 0) {


            //Long Url validation

            if (!isValid(longUrl))
                return res.status(400).send({ status: false, message: "Please enter longUrl and it must be a typeof string only" });

            if (!checkUrl(longUrl))
                return res.status(400).send({ status: false, message: "Invalid Url" });

            //long url is valid url or not checking validation
            if (!ValidUrl.isUri(longUrl)) {
                return res.status(400).send({ status: false, message: "Url Invalid!" });
            }

            let cachedUrlData = await GET_ASYNC(`${longUrl}`);    // SEARCHING FOR URL IN CLOUD STORAGE
            if (cachedUrlData) {
                return res.status(200).send({ status: true, message: "This Url is already shorten", data: cachedUrlData });
            } else {

                const urlId = ShortId.generate();    //  GENERATING SHORT-ID OF ORIGINAL URL
                const urlShort = baseUrl + "/" + urlId;
                req.body.shortUrl = urlShort;
                req.body.urlCode = urlId;

                const urlCreated = await UrlModel.create(req.body);
                let urlDetails = {
                    longUrl: urlCreated.longUrl,
                    shortUrl: urlCreated.shortUrl,
                    urlCode: urlCreated.urlCode
                };

                await SET_ASYNC(`${longUrl}`, (urlDetails.shortUrl));    // STORING THE DATA IN CLOUD FOR FURTHER USE
                res.status(201).send({ status: true, data: urlDetails });
            }
        } else {
            return res.status(400).send({ status: false, message: "Requested body cannot remain empty please provide some data" })
        }

    } catch (error) {
        return res.status(500).send({ status: false, message: error.message });
    }
}

const getUrl = async (req, res) => {
    try {
        const urlCode = req.params.urlCode;
        if (!ShortId.isValid(urlCode)) return res.status(400).send({ status: false, message: "Please enter valid urlCode" });    //  VALIDATING SHORT-ID CODE USING SHORTID PACKAGE

        let cachedUrlData = await GET_ASYNC(`${req.params.urlCode}`)
        if (cachedUrlData) {
            return res.redirect(cachedUrlData);
        } else {
            let requredUrl = await UrlModel.findOne({ urlCode: urlCode });
            if (!requredUrl) return res.status(404).send({ status: false, message: "No such url present" });
            await SET_ASYNC(`${req.params.urlCode}`, (requredUrl.longUrl));    // STORING THE DATA IN CLOUD FOR FURTHER USE

            return res.redirect(requredUrl.longUrl);
        }
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
    }
}


module.exports.createUrl = createUrl;
module.exports.getUrl = getUrl;