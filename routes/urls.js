import express from 'express';
import { nanoid } from 'nanoid';
import Url from '../models/Url.js';
import { validateUrl } from '../utils/utils.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../config/.env' });
import mreferrer from 'monkeys-referrer';
import DeviceDetector from "device-detector-js";
import geoip from 'geoip-lite';


const router = express.Router();

// Short URL Generator
router.post('/short', async (req, res) => {
    const { origUrl } = req.body;
    const base = process.env.BASE;

    const urlId = nanoid();
    if (validateUrl(origUrl)) {
        try {
            let url = await Url.findOne({ origUrl });
            if (url) {
                res.json(url);
            } else {
                const shortUrl = `${base}/${urlId}`;

                url = new Url({
                    origUrl,
                    shortUrl,
                    urlId,
                    date: new Date(),
                    data: {}
                });

                await url.save();
                res.json(url);
            }
        } catch (err) {
            console.log(err);
            res.status(500).json('Server Error');
        }
    } else {
        res.status(400).json('Invalid Original Url');
    }
});

// Original URL Redirect
router.get('/:urlId', async (req, res) => {
    try {

        const { urlId } = req.params

        console.log(urlId)
        let cookie_found = false;

        console.log(req.cookies, "cookies")

        if (req.cookies?.[`${urlId}_youshd`] === undefined) {
            console.log("cookie not found, adding it")
            res.cookie(`${urlId}_youshd`, urlId, {
                expires: new Date(Date.now() + 720 * 3600000) // cookie will be removed after 30 days
            })
        } else {
            console.log("cookie found")
            if (req.cookies?.[`${urlId}_youshd`] === urlId) {
                cookie_found = true;
            }
        }
        console.log(`Cookies: ${cookie_found}`)
        console.log(urlId)

        const url = await Url.findOne({ urlId: req.params.urlId });

        if (!url) {
            res.status(404).json('URL Not found');
            return
        }

        // let uniqueClicks = !cookie_found ? url.clicks + 1 : url.clicks;
        const ip = req.headers['x-forwarded-for'] || req.ip;
        console.log(ip); // ip address of the user
        const ip_data = geoip.lookup(ip); // location of the user


        const deviceDetector = new DeviceDetector();
        var ua = deviceDetector.parse(req.headers['user-agent']);
        var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
        var referrer = req.header('referrer');
        mreferrer.referrer.parse(fullUrl, referrer, function (err, desc) {
            let data = {
                type: 'click',
                cookie_found: cookie_found,
                last_cookie: req.cookies[`${urlId}_youshd`] ? "NA" : req.cookies[`${urlId}_youshd`],
                ip: { ip: req.ip, ...ip_data },
                ua,
                headers: req.headers,
                refs: desc,
                urlId: urlId,
            }

            const UrlModel = new Url({
                urlId: url.urlId,
                // clicks: uniqueClicks,
                // cookie_found,
                origUrl: url.origUrl,
                shortUrl: url.shortUrl,
                data
            })
            UrlModel.save()
        });


        return res.redirect(url.origUrl);
    } catch (err) {
        console.log(err);
        res.status(500).json('Server Error');
    }
});


// analytics: get uniqueClicks, totalClicks
router.get('/analytics/:urlId', async (req, res) => {

    const { urlId } = req.params;
    const url = await Url.findOne({ urlId });

    if (!url) {
        return res.status(404).json({ error: 'Link not found' });
    }

    const actualClicks = await Url.aggregate([
        { $match: { $and: [{ 'data.urlId': urlId }, { 'data.cookie_found': false }, { 'data.ua.client.type': 'browser' }] } },
        { $group: { _id: { device: '$data.ua.device', os: '$data.ua.os', ip: '$data.ip.ip' }, count: { $sum: 1 } } }, // -> drawback: multiple devices with same ua & ip will be counted as 1
        { $count: "real_clicks" }
    ]);


    const clickyClicks = await Url.find({ 'data.urlId': urlId, 'data.type': 'click' }).count();
    let realClicks = 0;
    try {
        realClicks = actualClicks[0].real_clicks
    } catch (e) {
        realClicks = 0;
    }
    const returnData = {
        actual_clicks: realClicks,
        clicky_clicks: clickyClicks,
    }
    res.send(returnData);
});

export default router;



