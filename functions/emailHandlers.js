require('dotenv').config();
const nodeMailer = require('nodemailer')
const { ConfirmationEmail } = require('../emailTemplates/confirmationEmail');

module.exports = {
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