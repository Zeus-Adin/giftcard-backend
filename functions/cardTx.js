require('dotenv').config();
const { ObjectId } = require('mongodb');
const { storeCard, getCard } = require('./cardTxImages');
let date = new Date();
date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
module.exports = {
    saveCardTx: async (reqOptions, db, res) => {
        const { userId, userName, currency, amount, rate, files, ecode, fileCount, cardType, action } = reqOptions
        try {
            const payload = { userId, userName, currency, amount, rate, files: '', ecode, fileCount, cardType, action, status: 'pending', timeStamp: date }

            const userValid = await db.collection('users').find({ $and: [{ _id: Object(userId) }, { username: userName }] }).toArray()
            if (userValid.lenght === 0) res.status(500).json({ regTx: false, message: 'Wrong user details!', result: {} })

            const { acknowledged, insertedId } = await db.collection('cards').insertOne(payload)
            if (!acknowledged) res.status(500).json({ regTx: acknowledged, message: 'Gift card register failed!', result: {} })
            const saveCards = await storeCard(files, insertedId)
            if (saveCards === 'none') {
                db.collection('cards').delete({ _id: ObjectId(insertedId) })
                res.status(500).json({ regCardTx: false, message: 'Gift card image upload failed, changes reverted!', result: {} })
            }

            const result = await db.collection('cards').updateOne({ _id: ObjectId(insertedId) }, { $set: { files: saveCards } })
            res.status(200).json({ regTx: true, message: 'Gift card sale request sent successful!', result })
        } catch (error) {
            res.status(500).json({ regCardTx: false, message: error.message, result: {} })
        }
    },
    getCardTx: async (reqOptions, db, res) => {
        const { username, id } = reqOptions
        const cardTx = await db.collection('cards').find({ $and: [{ userId: id }, { userName: username }] }).toArray()
        if (cardTx.length === 0) res.status(500).json({ success: false, message: 'Card not found', result: cardTx })
        let results = [];
        for (let i = 0; i < cardTx.length; i++) {
            const { success, message, error, result } = await getCard(cardTx[i].files)
            results.push({ success, message, error, url: result, tx: cardTx[i] })
        }
        res.status(200).json({ results })
    }
}