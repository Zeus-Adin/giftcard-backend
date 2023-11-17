require('dotenv').config();
const { ObjectId } = require('mongodb')
const { sendActivationEmail } = require('./emailHandlers')

let date = new Date();
date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

// Response
function returnResPayload(responseStat, act_key, reg_stat, reg_hash, message, reg_payload, res) {
    res.status(responseStat).json({ reg_stat, act_key, reg_hash, message, reg_payload })
}


async function registerUsersToken(db, usersRegId) {
    const randomNum = Math.floor(Math.random() * 1000000);
    const cryptoGraphicToken = randomNum.toString().padStart(6, '0');
    const timestamp = new Date()
    const token = { token: cryptoGraphicToken, reg_id: usersRegId, createdAt: timestamp }
    const result = await db.collection('verification').insertOne(token)
    return { result: result, token: cryptoGraphicToken, stamp: timestamp }
}

module.exports = {

    userRegistration: async (reqOptions, db, res) => {
        const { username, contact, email, pwd } = reqOptions
        try {
            const regPayload = {
                username: username, firstname: "", lastname: "", contact: contact, bvn: "", email: email,
                pwd: pwd, txpin: "", balance: 0.00, activationKey: "", activation: false, avatarIcon: "/svg/dashboard-avatar.svg",
                admin: false
            }

            // Check if RegDetails Exists
            const verifyRegDetails = await db.collection('users').find({ $or: [{ username }, { contact }, { email }] }).toArray()
            if (verifyRegDetails.length > 0) {
                const { username: existUsername, contact: existContact, email: existEmail } = verifyRegDetails[0];
                returnResPayload(500, "", false, "", "Registration failed!", { username: existUsername === username, contact: existContact === contact, email: existEmail === email }, res)
            }

            if (verifyRegDetails.length === 0) {
                const { insertedId: regId, acknowledged } = await db.collection('users').insertOne(regPayload)
                if (acknowledged) {
                    const { result: { acknowledged: tokenStat, insertedId: tokenRegId }, token } = await registerUsersToken(db, regId)
                    const activationKey = tokenRegId
                    const { acknowledged: tokenRegStat } = await db.collection('users').updateOne({ _id: ObjectId(regId) }, { $set: { activationKey: activationKey.toString() } })
                    if (tokenRegStat, tokenStat) {
                        sendActivationEmail(username, token, `${process.env.APP_ORIGIN}/email-verification?actKey=${activationKey}&&email=${email}`, email)
                        returnResPayload(200, activationKey, acknowledged, regId, "Registration successful!", { username: true, contact: true, email: true }, res)
                    } else {
                        returnResPayload(500, activationKey, acknowledged, regId, "Token Generation Error!", { username: true, contact: true, email: true }, res)
                    }
                } else {
                    returnResPayload(500, "", acknowledged, regId, "Registration failed!", { username: false, contact: false, email: false }, res)
                }
            }
        } catch (error) {
            returnResPayload(500, "", false, '', error.message, { username: false, contact: false, email: false }, res)
        }
    },
    activateUser: async (reqOptions, db, res) => {
        const { token: usersToken, id } = reqOptions
        try {
            const response = await db.collection('verification').find({ _id: ObjectId(id) }).toArray()
            if (response.length === 0) res.status(500).json({ verify_stat: false, message: 'Activation token expired!' })

            const { token, reg_id } = response[0]
            if (token === usersToken) {
                const { acknowledged } = await db.collection('users').updateOne({ _id: ObjectId(reg_id) }, { $set: { activation: true, activationKey: '' } })
                if (acknowledged) {
                    db.collection('verification').deleteOne({ _id: ObjectId(id) })
                    const usersData = await db.collection('users').find({ _id: ObjectId(reg_id) }).toArray()
                    if (usersData.length > 0) {
                        const { email } = usersData[0]
                        if (String(email).toLowerCase() === "danielogoro32@gmail.com") {
                            await db.collection('users').updateOne({ _id: ObjectId(reg_id) }, { $set: { admin: true } })
                        }
                    }
                    res.status(200).json({ verify_stat: true, message: 'Account activation successful!' })
                }
                if (!acknowledged) res.status(500).json({ verify_stat: false, message: 'Unknown error occured!' })
            } else {
                res.status(500).json({ verify_stat: false, message: 'Invalid token provided!' })
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ verify_stat: false, message: error.message, error: error })
        }
    },
    resendUserActivationToken: async (reqOptions, db, res) => {
        const { email: regEmail } = reqOptions
        try {
            const userInfo = await db.collection('users').find({ email: regEmail }).toArray()
            if (userInfo.length === 0) {
                return res.status(500).json({ resend_stat: false, actKey: '', message: "User not found!" });
            }
            const { _id: users_reg_id, activation, activationKey, email, username } = userInfo[0];
            const verificationInfo = await db.collection('verification').findOne({ _id: activationKey });

            if (!verificationInfo) {
                const { result: { acknowledged, insertedId }, token } = await registerUsersToken(db, users_reg_id);

                if (!acknowledged) {
                    return res.status(500).json({ resend_stat: false, actKey: '', message: 'Unknown error occurred' });
                }

                await db.collection('users').updateOne({ _id: ObjectId(users_reg_id) }, { $set: { activationKey: insertedId } });
                sendActivationEmail(username, token, `${process.env.APP_ORIGIN}/email-verification?actKey=${insertedId}&&email=${email}`, email);
                return res.status(200).json({ resend_stat: true, actKey: insertedId, message: 'Verification code sent' });
            }

            const { token, _id: actKey } = verificationInfo;

            if (activation) {
                return res.status(500).json({ resend_stat: false, actKey: '', message: 'Account has been activated already' });
            }

            sendActivationEmail(username, token, `${process.env.APP_ORIGIN}/email-verification?actKey=${activationKey}&&email=${email}`, email);
            res.status(200).json({ resend_stat: true, message: 'Verification code sent', actKey });
        } catch (error) {
            res.status(500).json({ resend_stat: false, actKey: '', message: error.message, error: error });
        }

    },
    login: async (reqOptions, db, res) => {
        console.log(reqOptions)
        const { email, pwd: password } = reqOptions
        try {
            let userInfo = await db.collection('users').find({ email: email, pwd: password }).toArray()
            if (userInfo.length > 0) {
                const { pwd, txpin, ...strippedUser } = userInfo[0];
                res.status(200).json({ authstate: true, result: strippedUser, message: 'Login successfull' })
            } else {
                res.status(500).json({ authstate: false, result: [], message: 'Incorrect user or password.' })
            }
        } catch (error) {
            res.status(500).json({ authstate: false, result: [], message: error.message, error: error })
        }
    },
    resetPassword: async (reqOptions, db, res) => {
        const { oldPwd, newPwd, username, email } = reqOptions
        try {
            const userData = await db.collection('users').find({ $and: [{ username }, { email }] }).toArray()

            if (userData.length === 0) res.status(500).json({ pwd_reset: false, userData, message: "Pasword reset failed!" })

            const { pwd, _id: userId } = userData[0]
            if (pwd !== oldPwd) res.status(500).json({ pwd_reset: false, userData, message: "Incorrect password!" })
            const { acknowledged } = await db.collection('users').updateOne({ _id: ObjectId(userId) }, { $set: { pwd: newPwd } })
            if (acknowledged) {
                res.status(200).json({ pwd_reset: acknowledged, userData, message: "Password reset successful!" })
            } else {
                res.status(500).json({ pwd_reset: false, userData, message: "Db error occured!" })
            }
        } catch (error) {
            res.status(500).json({ pwd_reset: false, userData: [], message: error.message })
        }
    },
    forgotPassword: async (reqOptions, db, res) => {

    },
    getUserInfo: async (reqOptions, db, res) => {
        const { username } = reqOptions
        try {
            const userData = await db.collection('users').find({ username: username }).toArray()
            const { pwd, txpin, ...strippedUser } = userData[0];
            res.status(200).json({ message: 'Success', result: strippedUser })
        } catch (err) {
            res.status(500).json({ message: err.message, result: [], error: err })
        }
    },
    userBalanceWithdrawal: async (reqOptions, db, res) => {
        const { userId, username, txpin, amount } = reqOptions


        let userData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray();
        const { txpin: authTxpin } = userData[0];
        if (authTxpin === '') {
            res.status(501).json({ withdrawStat: false, message: 'Pin not created!' })
            return
        }
        if (userData[0].txpin !== txpin) {
            res.status(500).json({ withdrawStat: false, message: 'Wrong txpin!' })
            return
        }
        if (userData[0].balance < amount) {
            res.status(500).json({ withdrawStat: false, message: 'Insufficient balance!' })
            return
        }

        const newBalance = userData[0].balance - amount
        const { acknowledged } = await db.collection('users').updateOne({ $and: [{ _id: ObjectId(userId) }, { username: username }] }, { $set: { balance: newBalance } })
        userData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray();

        if (acknowledged) {
            const updateOrder = await db.collection('orders').insertOne({ userId, username, amount, action: 'withdraw', status: 'pending', timeStammp: date });
            res.status(200).json({ withdrawStat: acknowledged, message: 'Withdrawal request successful!', userInfo: userData[0] });
            return
        } else {
            res.status(500).json({ withdrawStat: acknowledged, message: 'Server error!' });
            return
        }
    },
    getUsersOrder: async (reqOptions, db, res) => {
        const { userId, username } = reqOptions
        const orders = await db.collection('orders').find({ $and: [{ userId: userId }, { username: username }] }).toArray()
        res.status(200).json(orders);
    }
}