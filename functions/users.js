const nodeMailer = require('nodemailer')
const crypto = require('crypto')
const { ConfirmationEmail } = require('../emailTemplates/confirmationEmail')

module.exports = {
    registerUsersToken: async (db, usersRegId) => {
        const randomNum = Math.floor(Math.random() * 1000000);
        const cryptoGraphicToken = randomNum.toString().padStart(6, '0');
        const timestamp = new Date()
        const token = {
            token: cryptoGraphicToken,
            reg_id: usersRegId,
            createdAt: timestamp,
        }
        const result = await db.collection('verification').insertOne(token)
        return { result: result, token: cryptoGraphicToken, stamp: timestamp }
    },
    sendActivationEmail: async (username, token, activationurl, to) => {
        const emailBody = ConfirmationEmail(username, token, activationurl, to)
        const transporter = nodeMailer.createTransport({
            host: 'mail.bitcoinpro24.com',
            port: 465,
            secure: true,
            auth: {
                user: 'team@bitcoinpro24.com',
                pass: 'O*p@=i7kl-yE'
            }
        })
        transporter.sendMail({
            from: 'team@bitcoinpro24.com',
            to: to,
            subject: 'Activation',
            html: emailBody
        }).then(res => {
            console.log("Message sent: " + res.messageId)
        })
            .catch(e => console.log(e))

    }
}