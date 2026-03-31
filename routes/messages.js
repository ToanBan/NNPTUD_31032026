var express = require("express");
var router = express.Router();
let messageModel = require('../schemas/messages');
let { CheckLogin } = require('../utils/authHandler');
let multer = require('multer');
let path = require('path');
let fs = require('fs');

let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let dir = 'uploads/messages/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname);
        let fileName = Date.now() + '-' + Math.round(Math.random() * 1_000_000_000) + ext;
        cb(null, fileName);
    }
});
let upload = multer({ storage: storage });


router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUser = req.user._id;
        let otherUser = req.params.userID;

        let messages = await messageModel.find({
            $or: [
                { from: currentUser, to: otherUser },
                { from: otherUser, to: currentUser }
            ]
        })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')
            .sort({ createdAt: 1 });

        res.send(messages);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});


router.post('/', CheckLogin, upload.single('file'), async function (req, res, next) {
    try {
        let currentUser = req.user._id;
        let { to, text } = req.body;

        if (!to) {
            return res.status(400).send({ message: "to (userID người nhận) là bắt buộc" });
        }

        let messageContent;

        if (req.file) {
            messageContent = {
                type: "file",
                text: req.file.path
            };
        } else {
            if (!text) {
                return res.status(400).send({ message: "text là bắt buộc khi không gửi file" });
            }
            messageContent = {
                type: "text",
                text: text
            };
        }

        let newMessage = new messageModel({
            from: currentUser,
            to: to,
            messageContent: messageContent
        });

        await newMessage.save();
        await newMessage.populate('from', 'username fullName avatarUrl');
        await newMessage.populate('to', 'username fullName avatarUrl');

        res.send(newMessage);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});


router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUser = req.user._id;

        let messages = await messageModel.find({
            $or: [
                { from: currentUser },
                { to: currentUser }
            ]
        })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')
            .sort({ createdAt: -1 });

        let conversationMap = new Map();

        for (let msg of messages) {
            let partnerId = msg.from._id.toString() === currentUser.toString()
                ? msg.to._id.toString()
                : msg.from._id.toString();

            if (!conversationMap.has(partnerId)) {
                conversationMap.set(partnerId, msg);
            }
        }

        let result = Array.from(conversationMap.values());
        res.send(result);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
